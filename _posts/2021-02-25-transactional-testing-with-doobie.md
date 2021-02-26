---
title: "Transactional Testing with Doobie - MD"
layout: post
---

Lately I've been working a lot with Rob Norris' excellent [doobie](https://github.com/tpolecat/doobie) library for managing database queries in Scala.

Doobie is great, and you should definitely check it out. However it did take me a bit of time to figure out the best way to manage state cleanup for my database tests, so I'm going to describe my approach here in case it helps anyone.

## Context

This is one approach to isolating database-dependent tests so state from one test doesn't bleed into the next

The problem is that we want to avoid leaving state behind when a test interacts with the database so subsequent runs won't have their results affected by previous ones. There are a few different approaches to this, but my favorite is the strategy popularized by Rails' ActiveRecord and many other DB and ORM libraries of wrapping each test case in a non-committing transaction.

The idea is that before your test, as part of your setup, you open a new connection and set it to not commit. Then during the test case you can run any database interactions just like normal, and at the end you rollback the transaction which reverts the DB back to its original state. This is great because a) you don't have to try to manage your own cleanup code manually (truncating tables etc) and b) it's faster than many other approaches and in particular lets you run DB-reliant test cases in parallel.

Unfortunately it's also easier for libraries like ActiveRecord to provide this kind of interface, since they often use strategies like global connection pools or thread-local connections to manage transactions for you behind the scenes. Whereas the way most Scala applications are laid out, you're on the hook for managing more of this yourself by passing the Transactor around through your app.

Doobie does provide an API for disabling the default "commit after transact" behavior for the duration of a single `ConnectionIO` ([more info](https://github.com/tpolecat/doobie/issues/535#issuecomment-311202214)), but there's not a great built-in interface for globally preventing all `ConnectionIO`s from committing.

## Transaction-based Tests with Doobie

So here's 1 approach to creating such an interface and integrating it into your test suite. I'll show some examples with munit, although you should be able to wire up something similar in whatever test framework you're using.

The strategy works roughly like this:

1. At the beginning of our suite, open a connection pool against your test DB. In my case this is a postgres instance running locally on my dev machine, but you could also use Docker, or even a remote instance if you needed to.
2. At the beginning of each test, checkout a connection from the pool as part of your setup, and disable autocommit.
3. Construct a doobie Transactor _from this single connection_. This will be the transactor you'll use for the duration fo your test case, and it means that all `.transact(xa)` calls will consistently use the same non-committing connection.
4. After the test, in teardown, rollback the fixture connection instead of committing it.

Here's a code sample showing this worked up using munit, cats.effect.IO, and a Hikari connection pool.

For brevity I've omitted the imports from this code snippet but you can see the fully worked example in this [github repo](https://github.com/worace/doobie-transactional-tests).

```scala
class SandboxTest extends munit.FunSuite {
  // cats effect setup
  implicit val contextShift = cats.effect.IO.contextShift(ExecutionContext.global)
  val blocker = cats.effect.Blocker.liftExecutionContext(doobie.util.ExecutionContexts.synchronous)

  def startPool: HikariDataSource = {
    // set up a connection pool to your test DB like normal
    ???
  }

  // munit Suite-level fixtures for holding the connection pool
  // this happens once for each test class
  private var pool: HikariDataSource = null
  override def beforeAll(): Unit = {
    pool = startPool
  }

  override def afterAll(): Unit = {
    pool.close()
  }

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

class TransactionalExampleTest extends SandboxTest {
  fixture.test("transactional test") { ctx: Context =>
    for {
      // these queries will actually run against your database and yield real results
      // but any changes they make will be cleaned up at the end of the test
      _ <- sql"insert into foods (name) values ('pizza')".update.run.transact(ctx.xa)
      names <- sql"select name from foods".query[String].to[Vector].transact(ctx.xa)
    } yield {
      assertEquals(names, Vector("pizza"))
    }
  }
}
```

So that's pretty much it. When I first experimented with this I was a little skeptical about managing the connections myself and reaching into the Doobie Transactor configuration this way. But it has been working great for me in a fairly large test suite which uses a lot of DB interaction, and after the initial setup I haven't had to think about it until writing this post.

## In More Detail: Other Approaches

### Explicit Truncation
You can of course handle the db state problem manually, by explicitly re-setting the state of your db between each example. This could be done either by truncating all of your tables 1 by 1, or dropping the whole schema and re-migrating it.

This isn't the worst, but dropping and re-creating schemas can be slow, and truncating often requires you to keep your test truncation code up to date as you evolve your schema. And perhaps the biggest issue is this strategy limits your ability to run db-reliant tests in parallel, since they aren't isolated from one another in a transaction.

### Temp or In-Memory DB (e.g. H2 or SQLite)

You can also use a temporary (often in-memory) DB for your tests. SQLite and the pure-Java H2 database are popular choices for this, as they can be run locally as libraries (don't have to shell out to manage them) and have an in-memory mode that discards data at the end of your test runs. These DBs are fast and cheap to create, so you can afford to spin up an entirely new DB for every single test run, which gives great isolation between tests while still keeping things pretty fast.

However there are 2 downsides to this strategy:

1. Since you're starting from scratch each time, you'll have to apply schema migrations to prepare the fresh test DBs for your application. Not a huge deal but it can add time to each test case as the complexity of your schema grows.
2. Unless you're actually running SQLite or H2 in production (which you probably aren't), you'll be using a different DB between your test and prod environments. Which at best is kind of sketchy, because you'll likely paper over problems that won't reveal themselves until you deploy to prod. But more likely it's just not viable, because you're probably leveraging DB-specific features (PostGIS, anyone?) which won't exist in something like H2 or SQLite.

Several years ago there seemed to be a common attitude that an SQL DB was an interchangeable box in your system, and that your ORM's SQL interface (AcitveRecord, Hibernate, etc) would paper over differences by generating the proper vendor-specific SQL as needed. But nowadays the pendulum has shifted back toward relying on the DB as a processing tool and not just a generic relational store. Which is great IMO -- Postgres in particular is super powerful and we should leverage it -- but it means you probably don't want to try to use something different for testing.

### [TestContainers](https://www.testcontainers.org/)

Another approach that has been gaining a lot of popularity is using Docker containers to run dedicated test db instances. This lets you get a real Postgres or MySQL instance that can still be easily thrown away so you don't deal with tainted state between tests. And in recent years the TestContainers project has made this strategy much more viable by providing high quality library bindings for programmatically manipulating containers, so you can integrate the container lifecycle with your test framework and not have to rely on external tools like docker-compose. There's also a great library for integrating it with popular Scala test frameworks like Scalatest and Munit: https://github.com/testcontainers/testcontainers-scala

Here's an example of what it looks like in munit:

```scala
import com.dimafeng.testcontainers.PostgreSQLContainer
import com.dimafeng.testcontainers.munit.TestContainerForEach

class TestContainersExampleTest extends IOSuite with TestContainerForEach {
  override val containerDef = PostgreSQLContainer.Def()

  test(s"test postgres with testcontainer") {
    withContainers { postgresContainer =>
      ??? // Do stuff with postgres
    }
  }
}
```

However the biggest downside to all this IMHO is that it's just slow. Especially if you actually want to rely on it for providing a clean slate for each test that uses a DB connection, you'll have to spin up a fresh container for every test, which easily adds several seconds. You'll also have to apply schema migrations to those fresh containers to get them ready to use.

Here's a gif showing a comparison from the example repo linked above:

The DB interactions in these tests are pretty simplistic, but as you can see that's running 100 transaction/rollback tests (which actually insert and read data) before the first test container can even get booted.

I think a lot of people that use this approach rely on it for a relatively small number of integration tests where you're extensively exercising the system in a few complex scenarios. Then they rely on a mix of IO-less unit tests and/or mocking to test the rest of the system without the DB at all. So if that fits the profile of your application, it's probably a good way to go.

Unfortunately in many of the applications I work on, the RDBMS is a significant part of the application logic, so most of the things that would be meaningful for me to test need to rely on it. So in these cases its more beneficial to me to have fast transactional tests than more isolated container-based tests. But as always YMMV.
