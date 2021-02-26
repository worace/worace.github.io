---
title: "Transactional Sandbox Testing with Doobie"
layout: post
---

Lately I've been working a lot with Rob Norris' excellent [doobie](https://github.com/tpolecat/doobie) library for managing database queries in Scala. Here are a few notes on how I set up my test suite to cleanup state for tests that used the DB via doobie.

## Context

This is one approach to isolating database-dependent tests so state from one test doesn't bleed into the next. The idea is to wrap each test (and all of its database interactions) in a single top-level transaction which never commits. Then in your test teardown, you simply rollback the transaction which reverts the DB to its pristine state. This is the default testing setup in many full-stack web frameworks like Rails or [Phoenix](https://hexdocs.pm/ecto_sql/Ecto.Adapters.SQL.Sandbox.html), and while it can have some drawbacks in certain scenarios it's overall a great experience.

One benefit in particular is this allows your database-dependent tests in parallel, without having to manage a bunch of separate ad-hoc test DB instances (you just use a single shared, persistent test instance, which never actually gets any data written to it).

## Transaction-based Tests with Doobie

Doobie does provide an API ([Transactor.after.set](https://javadoc.io/doc/org.tpolecat/doobie-core_2.12/latest/doobie/util/transactor$$Transactor$.html)) for disabling the default "commit after transact" behavior temporarily. However I found this to be a little finicky, especially if I had tests that involved multiple `ConnectionIO`s which might get committed separately. There's [a bit of discussion in this issue](https://github.com/tpolecat/doobie/issues/535#issuecomment-311202214), but in my case I wanted to be able to run a "full slice" of my application, which might involve many different `ConnectionIO`s as well as some invocations of my application-level effect, which in this case is `cats.effect.IO`.

So I wired up a base `SandboxTest` which provides this functionality by manipulating a setting on a JDBC connection before passing it off to doobie. Note that I'm also using [munit-cats-effect](https://github.com/typelevel/munit-cats-effect) here which allows tests to return `IO[Assertion]`.

```scala
// Base test for providing non-commiting Transactor[IO] as an munit Fixture
abstract class SandboxTest extends munit.CatsEffectSuite {
  // cats effect setup
  implicit val contextShift = cats.effect.IO.contextShift(ExecutionContext.global)
  val blocker = cats.effect.Blocker.liftExecutionContext(doobie.util.ExecutionContexts.synchronous)

  // set up a connection pool to your test DB like normal
  def startPool: HikariDataSource = ???

  // munit Suite-level fixtures for holding the connection pool
  // this happens once for each test class
  private var pool: HikariDataSource = null
  override def beforeAll(): Unit = { pool = startPool }
  override def afterAll(): Unit = pool.close()

  // Context to provide into the individual tests as a scenario
  // This can be expanded to include an instance of your application,
  // some custom fixture instances, or whatever else you need to support your test examples
  // Note the connection itself must be passed through so it's available in teardown
  case class Context(conn: Connection, xa: Transactor[IO])
  val fixture = FunFixture[Context](
    setup = { test =>
      val conn = pool.getConnection()
      // Prevent the connection from committing early on your behalf
      conn.setAutoCommit(false)
      // Make a transactor wrapping this single connection instance, rather than the whole pool
      val xa = Transactor.fromConnection[IO](conn, blocker)
      val rollbackXa: Transactor[IO] = Transactor.strategy.set(
        xa,
        // Disable Doobie's default commit behavior
        Strategy.default.copy(after = DoNothing, oops = DoNothing, always = DoNothing)
      )
      Context(conn, rollbackXa)
    },
    teardown = { ctx =>
      // After the test, rollback and close the connection
      // This cleans up any changes you made to the DB during your test
      ctx.conn.rollback
      if (!ctx.conn.isClosed) {
        ctx.conn.close()
      }
    }
  )
}
```

Now each test class that uses this base can use its fixture to get a wrapped doobie transactor:

```scala
class TransactionalExampleTest extends SandboxTest {
  fixture.test("transactional test") { ctx: Context =>
    val xa: Transactor[IO]
    for {
      // these queries will actually run against your database and yield real results
      // but any changes they make will be cleaned up at the end of the test
      _ <- sql"insert into foods (name) values ('pizza')".update.run.transact(xa)
      names <- sql"select name from foods".query[String].to[Vector].transact(xa)
    } yield {
      assertEquals(names, Vector("pizza"))
    }
  }
}
```

For brevity I've omitted the imports from these snippets but you can see the fully worked example in this [github repo](https://github.com/worace/doobie-transactional-tests).

## Other Approaches

### Explicit Truncation

You can of course handle the db state problem manually, by explicitly re-setting the state of your db between each example. This could be done either by truncating all of your tables 1 by 1, or dropping the whole schema and re-migrating it.

This isn't the worst, but dropping and re-creating schemas can be slow, and truncating often requires you to keep your test truncation code up to date as you evolve your schema. And perhaps the biggest issue is this strategy limits your ability to run db-reliant tests in parallel, since they aren't isolated from one another in a transaction.

### Temp or In-Memory DB (e.g. H2 or SQLite)

You can also use a temporary (often in-memory) DB for your tests. SQLite and the pure-Java H2 database are popular choices for this, as they can be run locally as libraries (don't have to shell out to manage them) and have an in-memory mode that discards data at the end of your test runs.

These DBs are fast and cheap to create, so you can afford to spin up an entirely new DB for every single test run, which gives great isolation between tests while still keeping things pretty fast.

However unless you're actually running SQLite or H2 in production, you'll be using a different DB between your test and prod environments. Which at best is kind of sketchy, because you'll likely paper over problems that won't reveal themselves until you deploy to prod.

But more likely it's just not viable, because you're probably leveraging DB-specific features (PostGIS, anyone?) which won't exist in something like H2 or SQLite.

Several years ago there seemed to be a trend toward treating SQL DBs as interchangeable boxes that your ORM's SQL interface (AcitveRecord, Hibernate, etc) would paper over as needed.

But nowadays we're more happy to rely on our DBs as processing tools and not just generic relational stores. Which is great IMO -- Postgres in particular is super powerful and we should leverage it -- but it means you probably don't want to try to use something different for testing.

### TestContainers

Another approach that has been gaining a lot of popularity is using Docker containers to run dedicated test db instances. This lets you get a real Postgres or MySQL instance that can still be easily thrown away so you don't deal with tainted state between tests.

And in recent years the [TestContainers](https://www.testcontainers.org/) project has made this strategy much easier by providing high quality library bindings for programmatically manipulating containers, so you can integrate the container lifecycle with your test framework without relying external tools like docker-compose.

There's also a great library for integrating it with popular Scala test frameworks like Scalatest and Munit: [testcontainers-scala](https://github.com/testcontainers/testcontainers-scala).

Here's an example of what it looks like in munit:

```scala
import com.dimafeng.testcontainers.PostgreSQLContainer
import com.dimafeng.testcontainers.munit.TestContainerForEach

class TestContainersExampleTest extends munit.FunSuite with TestContainerForEach {
  override val containerDef = PostgreSQLContainer.Def()

  test("test postgres with testcontainer") {
    withContainers { postgresContainer =>
      ??? // Do stuff with postgres
    }
  }
}
```

So overall this is pretty nice, and it can be configured in a lot of different ways. You can achieve various configurations like 1 container per test, 1 per suite, a mix of multiple containers at once, etc.

However the biggest downside IMHO is that it can be pretty slow. Especially if you want to rely on containers for providing state isolation, you'll need a fresh one for each test, which can take sevral seconds. You also have to apply schema migrations to those fresh containers to get them ready to use.

Here's a gif showing a comparison from the example repo linked above:

![TestContainers vs. Transactional Tests](/public/images/transactional_vs_testcontainers.gif)

The DB interactions in these tests are admittedly pretty simplistic, but as you can see that's running 100 transaction/rollback tests (which actually insert and read data) before the first test container can even get booted.

I think a lot of people that use this approach rely on it for a relatively small number of integration tests where you're extensively exercising the system in a few complex scenarios. Then they rely on a mix of IO-less unit tests and/or mocking to test the rest of the system without the DB at all. So if that fits the profile of your application, it's probably a good way to go.

Unfortunately in many of the applications I work on, the RDBMS is a significant part of the application logic, so most of the things that would be meaningful for me to test need to rely on it. So in these cases its more beneficial to me to have fast transactional tests than more isolated container-based tests. But as always YMMV.

And of course there are some cases where the transaction/rollback approach doesn't work well:

* Your application actually needs to do tricky stuff of its own with transaction boundaries, so having them managed by the test suite is problematic
* You need an external process to see the results of your db operations, in which case transaction isolation won't work. This is common when running something like a browser-driven acceptance test, where an external process like selenium needs to connect to a live instance of your app and drive it.

So in these cases its great to have the TestContainers approach to fall back on.
