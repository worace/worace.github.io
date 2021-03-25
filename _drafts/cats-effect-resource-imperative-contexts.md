---
title: "Using Cats Effect Resource in Non-Functional Contexts"
layout: post
---

### Summary / TL;DR

Use [Resource.allocated](https://typelevel.org/cats-effect/api/cats/effect/Resource.html#allocated[G[x]%3E:F[x],B%3E:A](implicitF:cats.effect.BracketThrow[G]):G[(B,G[Unit])]) to integrate `cats.effect.Resource` into non-FP contexts such as a test framework setup/teardown methods or traditional callback-driven APIs. But be cautious in doing so, as it's now your responsibility to make sure the provided finalizer gets called at the appropriate time.

### Background

[Cats Effect Resource](https://typelevel.org/cats-effect/datatypes/resource.html) is an excellent tool for managing resource lifecycles in Scala. There are some great tutorials on Resource out there (such as this [video](https://www.youtube.com/watch?v=m9cu4xUvrUs)) so I will not spend too much detail on it here. But in short it provides something similar to Python's [with helper](https://docs.python.org/3/reference/compound_stmts.html#the-with-statement) or Java's [Try With Resources](https://www.baeldung.com/java-try-with-resources) but in a functional API which plays nice with `cats.effect.IO` or other pure effect types in Scala.

There are several ways to define a `Resource` but the easiest is using `Resource.make`, which follows a familiar "acquire" / "release" pattern:

```scala
import cats.effect.IO
import java.io.FileWriter

// Resource's signature is Resource[+F[_], +A], containing 2 type parameters:
// an effect F (e.g. cats.effect.IO)
// and the resource type A
val myFile: Resource[IO, FileWriter] = Resource.make {
  // acquire the resource by providing an IO[A] which generates it
  IO(new FileWriter("pizza.txt"))
} { file: FileWriter =>
  // release the resource by providing an IO[Unit] which closes it
  // Note that this block receives the resource as a parameter
  IO(file.close())
}
```

This "double block" syntax with 2 multi-line curly brace blocks may be unfamiliar, but it's simply exploiting Scala's [multiple parameter lists](https://docs.scala-lang.org/tour/multiple-parameter-lists.html) to allow the acquire and release args to be provided in sequence without wrapping parentheses.

Once you've constructed a resource (or rather, defined the logic for constructing it, as the actual construction is deferred), you can access it via the `use` method:

```scala
val myFile: Resource[IO, FileWriter] = ???
val result: IO[Unit] = myFile.use { file =>
  IO(file.write("pepperoni"))
}
```

## Integrating Resource into an App

Note that the block provided to `use` also expects an `IO` (its signature is `(f: (A) => G[B])`) and the whole thing now yields an `IO[B]`. `Resource`'s machinery folds the effectful acquire/release operations into the rest of your program to distill it into a single `IO[Blah]`.

This works especially smoothly in contexts where you can put the resource-management on the "outside" of a program, such as in [IOApp](https://typelevel.org/cats-effect/datatypes/ioapp.html). It's very common to see `IOApp` used along this pattern:

```scala
import cats.effect._

object Main extends IOApp {
  def context: Resource[IO, MyApp] = ???
  def run(args: List[String]): IO[ExitCode] = {
    context.use { app =>
      val res: IO[Unit] = app.doStuff
      res.map(_ => ExitCode.Success)
    }
  }
}
```

However, sometimes we don't have total control over the layering of a program, and instead have to fit a functional core, which may be heavily IO-based, into an imperative shell which is not. Some common scenarios where this comes up include:

* Test frameworks, which often use an imperative, stateful API for defining fixtures via a `setup` / `teardown` protocol.
* Traditional hook-driven APIs, such as web frameworks that provide their own lifecycle methods. For example, I ran into this recently trying to integrate `cats.effect.Resource` into the [ApplicationLifecycle](https://www.playframework.com/documentation/2.8.x/api/scala/play/api/inject/ApplicationLifecycle.html#addStopHook(hook:()=%3Escala.concurrent.Future[_]):Unit) of a Play application.

Luckily, Resource does provide an escape hatch for these situations: [allocated](https://typelevel.org/cats-effect/api/cats/effect/Resource.html#allocated[G[x]%3E:F[x],B%3E:A](implicitF:cats.effect.BracketThrow[G]):G[(B,G[Unit])]).

`Resource.allocated` basically provides an unsafe method for "unnesting" the typical resource management flow. Instead of `use`-ing your resource by providing an inner IO, you retrieve the value of it immediately, along with a callback which you are responsible for invoking to trigger the necessary release steps:

```scala
val appResource: Resource[IO, MyApp] = ???
val appLauncher: IO[(MyApp, IO[Unit])] = appResource.allocated
val (app, shutdownHook): (MyApp, IO[Unit]) = impLauncher.unsafeRunSync()

// Patch the deferred shutdown hook
myLifeCycle.addStopHook(shutdownHook.unsafeToFuture())
```

It's not the ideal way to use `cats.effect.Resource`, but it's a very useful escape hatch when needed. However, do keep in mind that (as clearly emphasized in the docs), this approach removes some of the built-in safety which Resource provides:

> For this reason, this is an advanced and potentially unsafe api which can cause a resource leak if not used correctly, please prefer use as the standard way of running a Resource program.
