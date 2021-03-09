---
title: "Play! Nice: Better Play Framework Pipelines with Cats Effect"
layout: post
---

## Summary

TL;DR: Play is mostly pretty good but the built-in [Action Composition](https://www.playframework.com/documentation/2.8.x/ScalaActionsComposition) helpers can be hard to use.

Instead, roll your own, using cats-effect to model a web request pipeline:

```scala
import cats.effect.{IO, EitherT}
import play.api.mvc.Result

object PipelineTypes {
  type PipelineStage[A] = EitherT[IO, Result, A]
  type PipelineRes = PipelineStage[Result]
}
```

Then add some extensions and helpers to integrate the new model with existing types:

```scala
// Mixin for your Play controllers
trait PipelineHelpers {
  import PipelineTypes._

  def cc: play.api.mvc.ControllerComponents // Provide this from your controller instances

  def Handler(h: (Request[AnyContent]) => PipelineRes): Action[AnyContent] = {
    cc.actionBuilder.async { req: Request[AnyContent] =>
      h(req).fold(a => a, b => b).unsafeToFuture()
    }
  }
}

// Extension methods to adapt common types into pipelines
object PipelineExtensions {
  implicit class IOOptionExts[A](r: IO[Option[A]]) {
    // IO[Option[MyRecord]](None).orNotFound
    // Handles the very common "load this record from DB and give 404 if it's not there"
    def orNotFound: PipelineStage[A] = orRes(NotFound("Not Found"))

    // IO[Option[MyRecord]](None).orRes(Redirect("/pizza"))
    def orRes(res: Result): PipelineStage[A] = EitherT {
      r.map(o => Either.fromOption(o, res))
    }
  }

  // pass any IO[A] through to a pipeline context by calling .piped
  // IO("some data").piped -> EitherT[IO, Result, String]
  implicit class IOToPipelineStage[A](r: IO[A]) {
    def piped: PipelineStage[A] = EitherT {
      r.map(a => Either.right[Result, A](a))
    }
  }

  // ...add your own as needed
}
```

Then use it in a controller for nice clean `for / yield` request pipelines:

```scala
class MyController {
  def download(fileId: UUID) = Handler { implicit req =>
    for {
      u <- Pipeline.authed // reusable auth pipeline: PipelineStage[User]
      savedFile <- myApp.uploads.get(uploadId).orNotFound
      // Permission helper I have added -- gives PipelineStage[E] for the permitted entity
      _ <- Pipeline.permitted(u, Permission.View, savedFile)
      url <- myApp.cloudStorage.signedDownloadUrl(upload).piped
    } yield {
      Redirect(url.toString)
    }
  }
}
```

## Long Version

In the last few months I've been doing some work on a growing Play Framework project in Scala. Play seems to have fallen slightly in the hype cycle, but it's pretty solid. As far as statically typed full-stack web dev goes it's one of the better options available in any language.

Here's a super abbreviated list of some of the good parts:

* Solid implementation of MVC patterns
* Built-in support for all the web handling goodies you need (sessions, CORS, CSRF, Forms, Flash, Response Formats, etc)
* Statically typed routing + parameter handling -- Seriously, if you forget a route or mis-match a parameter between your routes and your controller, your app won't compile
* Statically typed web templates -- No more `ActionView::TemplateError` b/c you mis-named an instance variable in your template
* Helpers and Plugins for common web tasks like asset digesting
* Fast Enough (TM) for most use-cases, as long as you don't get too sloppy blocking threads when you shouldn't

So all that stuff is great, and makes for a pretty productive dev experience. Especially given the recent "SPA Backlash" and resurgence of interest in traditional web apps with boring old server-side rendering (see e.g. [HotWire](https://hotwire.dev/), [Phoenix](https://phoenixframework.org/) and [Phoenix LiveView](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html), [Help! None of my projects want to be SPAs](https://whatisjasongoldstein.com/writing/help-none-of-my-projects-want-to-be-spas/)), maybe we'll see some revived interest in Play. Who knows -- maybe there could even be a Play variant of the HotWire/LiveView style of server-based dynamic rendering at some point.

There are a couple smallish things that I don't love: all the Guice and Java-style DI stuff is gross (I just don't use it -- passing args to methods is fine), and as always you have to be vigilant to keep the framework's machinery from seeping into your domain model (use a separate sbt module for your core app vs. your web interface, a la [Hexagonal Architecture](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software))).

But the biggest annoyance that IMHO keeps Play from being really great is a lack of ergonomics around customizing and chaining controller actions.

## Action Composition and Request Pipeline Abstraction in Play

### The Problem

Web applications take in an HTTP Request and, through a series of developer-defined steps, generate a corresponding HTTP Response.

A pattern in many web frameworks is to provide some sort of abstraction for modeling this process as a pipeline of steps. Each step can either modify the working context and continue the pipeline (loading the current user is a classic example), or abort the pipeline by providing an HTTP response.

The "abort and provide a response" path often represents an error state: for example a pipeline requiring an authenticated user might abort and redirect to the `/login` path if there was none. This pattern can be applied outside the context of web programming as well -- sometimes it's called [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/).

Different web frameworks have different approaches to modeling request pipelines. In Rails you have [filters](https://guides.rubyonrails.org/action_controller_overview.html#filters) which can modify request context by manipulating the current controller instance state. Elixir's Phoenix has a well-developed API for defining [pipelines](https://hexdocs.pm/phoenix/routing.html#pipelines) consisting of [plugs](https://hexdocs.pm/phoenix/plug.html). Django follows the Python pattern of using method [decorators](https://docs.djangoproject.com/en/3.1/topics/http/decorators/) to wrap request handlers in re-usable pipeline logic. Http4s, another popular Scala web library, takes a heavily functional and type-driven approach by modeling [middleware](https://http4s.org/v0.18/middleware/) using [Kleisli](https://typelevel.org/cats/datatypes/kleisli.html) + [OptionT](https://typelevel.org/cats/datatypes/optiont.html).

Reasons you'd want to use these pipeline-oriented abstractions range widely, but they're extremely handy for keeping a web service codebase under control. Some examples of pipeline-ish things include:

* Loading the current user
* Requiring authentication
* Checking permissions
* DRY up resource-loading code by moving common DB lookups into pipeline stages

You can of course just do all these things inline in your request handlers. But having a standard way to define and re-use them helps keep your handler implementations short and focused on what is specific to each particular route.

### Play's Approach

In Play, [Action](https://www.playframework.com/documentation/2.8.x/ScalaActions) is the core abstraction representing the HTTP request/response lifecycle. An Action represents the transformation `play.api.mvc.Request => play.api.mvc.Result`, which makes sense.

```scala
Action { request =>
  Ok("Turning a Request into a Result!")
}
```

For more complicated things, like the various request Pipeline cases mentioned above, Play provides some additional types and helpers for dealing with [Action Composition](https://www.playframework.com/documentation/2.8.x/ScalaActionsComposition):

* [ActionFilter](https://www.playframework.com/documentation/2.8.x/api/scala/play/api/mvc/ActionFilter.html) - Pass the request through unmodified, or exit the pipeline early by providing a response
* [ActionRefiner](https://www.playframework.com/documentation/2.8.x/api/scala/play/api/mvc/ActionRefiner.html) - Like ActionFilter, except that you can modify the Request type (e.g. to provide new context)
* [ActionTransformer](https://www.playframework.com/documentation/2.8.x/api/scala/play/api/mvc/ActionTransformer.html) - Transform one request to another (no chance for early exit)
* [ActionBuilder](https://www.playframework.com/documentation/2.8.x/api/scala/play/api/mvc/ActionBuilder.html) - Not really part of the filter/refine/transform Pipeline API per se, but gives some helpers for constructing Actions
* [ActionFunction](https://www.playframework.com/documentation/2.8.x/api/scala/play/api/mvc/ActionFunction.html) - Base type for all of the above -- you generally won't use it directly.

From the descriptions and from reading examples in the docs, these all seem reasonable.

But unfortunately, in my experience, they're just absolutely **maddening** to work with.

It's hard for me to accurately describe all of the various issues I've run into (I wish I had done a better job at saving the many compiler errors and use-cases I've failed to implement with these APIs), but I can say they were quite deterring. I may not be the most expert Scala user in the whole world, but I'm not bad, and my success rate in doing anything slightly non-trivial with Action handling in Play is about 1 in 6.

I'm not sure I really understand all of the API design subtleties at play (ha!) with these features, but my hunch is that it comes down to some combination of these:

1. The `Action*` APIs are all generic over the type of the incoming request body, as well as over the type of the Request being handled. For example in `trait ActionBuilder[+R[_], B]`, the `B` represents an HTTP Body, for which you must provide a corresponding `BodyParser[B]`, while the `+R[_]` represents a Request. The request has to be generic because you might have to swap it out for your own (more on that in a second). This may be a reasonable and correct way to model this stuff, but for inexperienced users it becomes unwieldy quickly.
2. These APIs are all inheritance (trait) based which means you have to interface with them via defining new classes of your own. This leads to a lot of boilerplate, and makes it hard to quickly spin up ad-hoc implementations as you go. Especially once you start wanting to introduce your own parameters (to allow call-site customization of the Actions you're building), it gets really hard to keep your definitions inline with the inheritance interfaces required by the base traits.
3. As a statically typed framework, Play faces a challenge of what to do with new **contextual data** during Request processing.

Even if you can master enough of the type hierarchy awareness required to confidently develop around points 1 and 2, point 3 turns out to be a pretty significant hurdle in providing a convenient developer API.

Why is this such a problem for Play? Well, in dynamic language web frameworks, it's common to stuff arbitrary data into the request context. For example in a Rails controller any object can be stashed as an instance variable at any point and thus retrieved via subsequent steps. Elixir's Plug provides an [assigns](https://hexdocs.pm/plug/Plug.Conn.html#assign/3) field on its `Conn` type for a similar purpose.

Play provides a statically typed solution in the form of [WrappedRequest](https://www.playframework.com/documentation/2.8.x/api/scala/play/api/mvc/WrappedRequest.html). For example it's very common to see applications define a `UserRequest` for tracking the authentication state of the request:

```scala
class UserRequest[A](val user: Option[User], request: Request[A]) extends WrappedRequest[A](request)
```

Then you'd define a custom `ActionBuilder` which takes an existing request, fetches your user, and wraps it:

```scala
class UserAction // Some constructor boilerplate elided here...
  // mapping from a Request to a UserRequest
  extends ActionTransformer[Request, UserRequest] {
  def transform[A](baseRequest: Request[A]) = {
    val user: Future[Option[User]] = ??? // go get your user
    user.map { u => new UserRequest(u, baseRequest) }
  }
}
```

Ok, makes sense I guess.

But what if I need further composition? Maybe I have a `WidgetController` where I want to have a transformer to load a `Widget`. Well that could be an `ActionTransformer[UserRequest, WidgetRequest]`. And maybe there's also a nested route where widgets can also have `Order`s I want to load, so that would be `ActionTransformer[WidgetRequest, OrderRequest]`.

So this is a little bit annoying, since I have to roll a new custom `WrappedRequest` instance for each of these scenarios. But it's at least tractable.

However, what I if I also want to have an `OrderRequest` where I _didn't_ load the widget first? Well, requiring concrete implementations for each variant of Request context I need to model forces me to spin up new definitions for every **combination** of flow we'd need. It's very challenging to do them ad-hoc.

```
UserRequest --> WidgetRequest --> WidgetOrderRequest
UserRequest --> UserOrderRequest
FooRequest --> FooOrderRequest ---> I can't just re-use my order-loading filter :(
```

**Aside:** I've been loosely following how web tools in the Rust ecosystem solve this problem, since they face similar challenges. [Rocket](https://rocket.rs/) for example uses an interesting combination of [routing macros](https://api.rocket.rs/v0.4/rocket/attr.get.html) and [typeclasses](https://api.rocket.rs/v0.4/rocket/request/trait.FromRequest.html). I haven't had a chance to dig into this but hope to explore it further.

### An Alternative: Making Friends with Cats

After struggling with the Action API for a while I finally decided maybe things don't actually have to be this complicated. The [Railway](https://fsharpforfunandprofit.com/rop/) model really feels like the right thing here: I need a simple way to express the optionality of exiting early (with an HTTP response) or continuing the pipeline, potentially with additional new context.

In dynamic langs, this is easy, because we can duck-type our way through it:

```elixir
# elixir example in phoenix
# Framework checks for an early response between each stage
# As long as you don't botch the return type from a stage too badly, you'll be ok
pipeline :browser do
  plug :accepts, ["html"]
  plug :fetch_session
  plug :fetch_flash
  plug :protect_from_forgery
  plug :put_secure_browser_headers
end
```

But in Scala we need to express it statically, and one way to do it is using `Either`.

Each intermediate stage of a web request "pipeline" can either return an early Response, or continue with new info: `Either[play.api.mvc.Result, A]`. For the final (non-intermediate) step of the pipeline, the righthand response must also be a `Result`, so you have `Either[play.api.mvc.Result, play.api.mvc.Result]`.

Then, there's 1 more hiccup, which is that most web programming in Scala is going to be done async, with an effect type. In Play this is usually `Future`, but in my own application I'm also using `cats.effect.IO`.

So my types actually end up as `IO[Either[play.api.mvc.Result, A]]`. This nesting can be cumbersome, so I've brought in [EitherT](https://typelevel.org/cats/datatypes/eithert.html) from Cats to manage it.

So...in my app I have some custom types like:

```scala
import cats.effect.{IO, EitherT}
import play.api.mvc.Result

object PipelineTypes {
  // As mentioned, I'm using cats.effect.IO here.
  // But you could also achieve the same with Future
  // Or if you want to be really fancy make this tagless final to generalize to other effects
  type PipelineStage[A] = EitherT[IO, Result, A]
  type PipelineRes = PipelineStage[Result]
}
```

And I add a helper to my controller to provide an alternative to the default `Action` builder:

```scala
trait PipelineHelpers {
  import PipelineTypes._

  def cc: play.api.mvc.ControllerComponents // Provide this from your controller instances

  def Handler(h: (Request[AnyContent]) => PipelineRes): Action[AnyContent] = {
    cc.actionBuilder.async { req: Request[AnyContent] =>
      // here is the "end of the world", where the Cats Effects
      // get turned into side effects
      h(req).fold(a => a, b => b).unsafeToFuture()
    }
  }
}
```

So now your controllers can use `Handler` instead of `Action`, and skip the Play `ActionBuilder` machinery entirely.

And, since it uses `EitherT`...to chain pipeline stages you can just `for / yield` like normal:

```scala
  def download(fileId: UUID) = Handler { implicit req =>
    for {
      u <- Pipeline.authed // reusable auth pipeline: PipelineStage[User]
      savedFile <- myApp.uploads.get(uploadId).orNotFound
      // Permission helper I have added -- gives PipelineStage[E] for the permitted entity
      _ <- Pipeline.permitted(u, Permission.View, savedFile, ())
      url <- myApp.cloudStorage.signedDownloadUrl(upload).piped
    } yield {
      Redirect(url.toString)
    }
  }
```

What about `orNotFound` or `piped`? I added these extensions in my controllers to adapt common datatypes into this pipeline model.

```scala
object PipelineExtensions {
  implicit class IOOptionExts[A](r: IO[Option[A]]) {
    // IO[Option[MyRecord]](None).orNotFound
    // Handles the very common "load this record from DB and give 404 if it's not there"
    def orNotFound: PipelineStage[A] = orRes(NotFound("Not Found"))

    // IO[Option[MyRecord]](None).orRes(Redirect("/pizza"))
    def orRes(res: Result): PipelineStage[A] = EitherT {
      r.map(o => Either.fromOption(o, res))
    }
  }

  // pass any IO[A] through to a pipeline context by calling .piped
  // IO("some data").piped -> EitherT[IO, Result, String]
  implicit class IOToPipelineStage[A](r: IO[A]) {
    def piped: PipelineStage[A] = EitherT {
      r.map(a => Either.right[Result, A](a))
    }
  }
}
```

Over time I've accumulated maybe 50 lines or so of these helpers, but they've been quite stable. Compared to the hours lost fighting with the built-in play framework Action builders, this approach has been quite productive for me. And, maybe best of all, my controller code is _much_ cleaner.

It's very common in Play framework code to see big nested controller methods due to the complexities of handling effect types (`Future`) alongside the various error cases that can arise. But I just don't have that anymore. Instead all my controller methods are nice linear stacks of `for { ... } yield { SomeResponse (...) }`.

To me, `for / yield` (i.e. a bunch of `flatMap`s in a trenchcoat) is the natural way to handle this kind of railway chaining in Scala. It's much nicer to compose these ad-hoc scopes on the fly rather than have to define a new concrete `WrappedRequest` and a bunch of OOP boilerplate for each permutation of re-usable scope you might want to chain.

I've also found the experience of using `EitherT` in this way to actually be pretty good. I was nervous about relying on it so heavily because I know it can give terrible compiler messages in some cases. But I haven't had too many issues. My hunch is that it helps to have the whole pipeline wrapped in the outer `Handler` helper: `def Handler(h: (Request[AnyContent]) => PipelineRes): Action[AnyContent]`, which keeps the type inference constrained compared to an open-ended `EitherT`.

So, that's the gist of it. This may seem like a lot of fuss about a narrow slice of the application, but in my experience the handling of request pipelines is one of the most fundamental points of ergonomics for a web framework. How this is handled sets the groundwork for how clean and reusable your web-layer code can be.

Doing it cleanly in a statically typed language like Scala isn't trival, but the benefits are also great: I now have an API that approaches the convenience and conciseness of things like Rails but is also compiler-verified all the way from routing to templates.

## Other thoughts

### How does this compare with http4s' Kleisli setup?

Honestly I'm not sure and I'd like to understand it better. I have not used http4s much, and Kleisli has so far been a bridge too far in my own personal FP journey. Maybe I'll get there evenutally but whenever I've looked at it I've found it too abstract. My hunch is that the `Kliesli` / `OptionT` approach to middleware used in http4s is solving a similar problem, and may even be isomorphic to what I'm doing with these `EitherT` helpers. Maybe someone who knows FP better can explain this to me.

### What about ZIO?

I don't really know. I haven't tried to use it yet nor had a chance to research it thoroughly. I'm a touch put off by all the hype / marketing being poured on, but would like to take a look at some point.

I'm not sure what the HTTP / Web Server situation is in ZIO but I could imagine some benefits from using the error channel to handle similar things to what I'm doing here (I know `ZIO` is often billed as a nicer `EitherT` alternative). However I've been pretty happy with `EitherT` in this scenario so I don't feel a ton of need to branch out. And I tend to manage the Dependency Injection aspects of my apps with plain old arg passing and object constructors, so I'm not sure I would get as much value from the Reader / Env channel. But I hope to have a chance to learn more about this at some point.

### What about EitherT overhead?

I've seen occasional discussion about the overhead introduced by all the wrapping involved with monad transformers like `EitherT` (oops I almost got through this whole post without saying the M-word). I'm sure there is some cost to this -- you're obviously allocating more objects and adding method calls to your code path. But most of my endpoints are doing at least 1 DB lookup already, if not many DB lookups, so it's just hard for me to imagine this overhead adds up to anything significant in comparison.

I have not taken the time to microbenchmark these aspects of the app, but I have certainly run load tests (via [gatling](https://github.com/gatling/gatling)) and the results there have been perfectly fine.

Maybe my use-case is different -- I'm deliberately doing "full stack" web work here, with lots of data lookups, etc, and I'm much more concerned with dev ergonomics and code cleanliness than I am with micro-optimizing a few milliseconds off of my endpoints. But as it is I'm confident that even on a modestly resourced server this setup will be humming along happily long after my database (which is the real bottleneck) has given up the ghost.
