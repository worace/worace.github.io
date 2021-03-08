---
title: "Play! Nice: Better Play Framework Pipelines with Cats"
layout: post
---

In the last few months I've been doing a lot of work on a growing Play Framework project in Scala. I'll have to cover this in more detail in another post, but overall I think Play is pretty great. It seems to have fallen slightly in the hype cycle, but as far as statically typed full-stack web dev goes it's one of the better options available in any language.

Here's a super abbreviated list of some of the good parts:

* Solid implementation of MVC patterns
* Built-in support for all the web handling goodies you need (sessions, CORS, CSRF, Forms, Flash, Response Formats, etc)
* Statically typed routing + parameter handling
* Statically typed web templates
* Helpers and Plugins for common web tasks like asset digesting
* Fast Enough (TM) for most use-cases, as long as you don't get too sloppy with blocking threads

So all that stuff is great, and makes for a pretty productive dev experience. Especially given the recent "SPA Backlash" and resurgence of interest in "traditional" web apps with boring old server-side rendering (see e.g. [HotWire](https://hotwire.dev/), [Phoenix](https://phoenixframework.org/) and [Phoenix LiveView](https://hexdocs.pm/phoenix_live_view/Phoenix.LiveView.html), [Help! None of my projects want to be SPAs](https://whatisjasongoldstein.com/writing/help-none-of-my-projects-want-to-be-spas/)), maybe we'll see some revived interest in Play. Who knows -- maybe there could even be a Play variant of the HotWire/LiveView style of server-based dynamic rendering at some point.

But, there are still 2 (well maybe 2 and a half?) big areas that I think Play falls short:

### Annoyance 1: Don't let the framework take over

Like any big framework, it's easy for Play's APIs and machinery to seep deeply into your domain model. This is maybe even more annoying in Play, since it's also fairly "unopinionated" when it comes to model + persistence layer logic, so you're not getting as much in exchange for your ecosystem lock-in as you would in something like Rails.

#### Solution

Fortunately there are well-established software patterns for dealing with this problem, commonly described as the [Hexagonal Architecture](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)) or "Ports and Adaptors" pattern. In short, develop your core domain logic in isolation of any interface concerns like web request, HTML formatting, etc. Then when you need to add these features to your project, have the web layer consume your core application as if it were a library, providing the domain-level APIs you need to drive the system (fetching persisted records, initiating asynchronous workflows, etc).

One easy way to do this in Scala is to use [sbt subprojects](https://www.scala-sbt.org/1.x/docs/Multi-Project.html) to isolate your core domain from your web interface layer. I have one project "core", which contains the domain (including persistence logic, asynchronous task management, external service integrations, etc). This project has 0 `play-*` dependencies, and can be compiled and tested in isolation. Then I have a separate "web" project which depends on the core one. In my application Loader I initialize an instance of the core application, and pass it through as a dependency to the various web components that need it.

I'm happy with Play at the moment, but maybe in the future I'll change my mind. And following this design approach means doing that would be inconvenient but not a catastrophic overhaul.

### Annoyance 2: All the Java + DI stuff is kind of lame

I'm not really aware of the history here but IMO the decision to add dedicated Java APIs and move to things like Guice weakened the APIs and dev experience for Scala users. And it's hard to imagine this has led to a ton of success in reaching out to the enterprise-y Java crowd -- seriously who is going to use Play in Java when there are so many more mainstream options like Spring Boot, Micronaut, etc? So it feels like a bit of a misstep to me.

#### Solution

Luckily this one is pretty easy to avoid as well: just don't use Guice and all the DI stuff. I don't use it in my web code, and I would _definitely_ not let it into my core domain code. I personally just construct my controller instances in my app loader manually. Seriously, I just have a bunch of lines like:

```scala
  lazy val collectionController = new _root_.controllers.CollectionController(controllerComponents, actorSystem)
  lazy val authController = new _root_.controllers.AuthController(oauth, myApp, controllerComponents)
  lazy val apiController = new _root_.controllers.ApiController(cc, assets)
  // etc...
  lazy val router: Router = new _root_.router.Routes(
    httpErrorHandler,
    collectionController,
    collectionSettingsController,
    // etc...
  )
```

It's not that bad. If you find this intolerable, look into [macwire](https://github.com/softwaremill/macwire), which also seems to be pretty popular for this use-case.

## The Big One: Play's Action Builder / Action Composition Mechanism Could be Improved

My biggest day to day issues working with the framework have stemmed from the Action Builder API. This seems somewhat niche -- it's only one portion of Play's API, meriting a single page in the documentation. But it's actually pretty fundamental to the common problems you encounter constructing server-side web request pipelines, and my issues using these tools effectively ultimately led me to eschew them in favor of my own custom abstractions.

### The Problem

Web applications take in an HTTP Request and, through a series of developer-defined steps, generate a corresponding HTTP Response. A common pattern in many web frameworks is to model this using some sort of "pipeline" abstraction. You start with a request (or, more likely, some framework-provided helpers for addressing portions of the request, like `headers`, `body`, etc). Then you have some API for adding pipeline "steps". Each step can either modify the working context and continue the pipeline (e.g. loading the current user based on Session info), or abort the pipeline by providing an HTTP response. The "abort and provide a response" path often represents an error state: this pipeline requires an authenticated user, but there was none, so our response is an HTTP redirect to the `/login` path. Outside the context of web development this pattern is sometimes called [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/).

Different web frameworks have different approaches to modeling request pipelines. In Rails you have [filters](https://guides.rubyonrails.org/action_controller_overview.html#filters) which can modify the current context (an instance of a controller class) by manipulating instance variables. Elixir's Phoenix has a well-developed API for defining [pipelines](https://hexdocs.pm/phoenix/routing.html#pipelines) consisting of [plugs](https://hexdocs.pm/phoenix/plug.html). Django follows the Python pattern of using method [decorators](https://docs.djangoproject.com/en/3.1/topics/http/decorators/) to wrap request handlers in re-usable pipeline logic. Http4s, another popular Scala web library, takes a type-driven approach and models [middleware](https://http4s.org/v0.18/middleware/) using [Kleisli](https://typelevel.org/cats/datatypes/kleisli.html).

Some frameworks also provide a separate abstraction for adding global wrappers, as opposed to the more composable, ad-hoc ones used for application-level pipeline composition. For example in Rails you can also tap into the underlying [Rack](https://github.com/rack/rack) networking layer to add global [middleware](https://guides.rubyonrails.org/rails_on_rack.html). However these interfaces tend to cater to global concerns like logging and instrumentation and can often be configured once and forgotten.

### Play's Approach

In Play, [Action](https://www.playframework.com/documentation/2.8.x/ScalaActions) is the core abstraction representing the HTTP request/response lifecycle. Per the docs it roughly represents the signature: `play.api.mvc.Request => play.api.mvc.Result`, which intuitively makes a lot of sense -- that is what a webserver does after all. And as long as you stick to fairly basic use-cases, it all works out OK:

```
Action { request =>
  Ok("Got request [" + request + "]")
}
```

Pretty much does what you would expect. You'll get out an HTTP 200 with the specified response body. Inside the block you can access attributes from the request like headers, render templates, call into your own code, etc.

For more complicated things, like the various request Pipeline cases mentioned above, Play provides some additional types and helpers for dealing with [Action Composition](https://www.playframework.com/documentation/2.8.x/ScalaActionsComposition):

* [ActionFilter](https://www.playframework.com/documentation/2.8.x/api/scala/play/api/mvc/ActionFilter.html) - Pass the request through unmodified, or exit the pipeline early by providing a response
* [ActionRefiner](https://www.playframework.com/documentation/2.8.x/api/scala/play/api/mvc/ActionRefiner.html) - Like ActionFilter, except that you can modify the Request type (e.g. to provide new context)
* [ActionTransformer](https://www.playframework.com/documentation/2.8.x/api/scala/play/api/mvc/ActionTransformer.html) - Transform one request to another (no chance for early exit)
* [ActionBuilder](https://www.playframework.com/documentation/2.8.x/api/scala/play/api/mvc/ActionBuilder.html) - Not really part of the filter/refine/transform Pipeline API per se, but gives some helpers for constructing Actions
* [ActionFunction](https://www.playframework.com/documentation/2.8.x/api/scala/play/api/mvc/ActionFunction.html) - Base type for all of the above -- you generally won't use it directly.

From the descriptions and from reading examples in the docs, this all sounds fine and dandy. But unfortunately in my experience they're just absolutely maddening to work with. It's hard for me to accurately describe all of the various issues I've run into (I wish I had done a better job at saving the many compiler errors and use-cases I've failed to implement with these APIs), but I can say they were quite deterring. I may not be the most expert Scala user in the whole world, but I'm not bad, and my success rate in doing anything slightly non-trivial with Action handling in Play is about 1 in 6.

I'm not sure I really understand all of the API design subtleties at play (ha!) in these features, but my hunch is it comes down to some combination of these:

1. The `Action*` APIs are all generic over the type of the incoming request body, as well as over the type of the Request being handled. For example in `trait ActionBuilder[+R[_], B]`, the `B` represents an HTTP Body, for which you must provide a corresponding `BodyParser[B]`, while the `+R[_]` represents a Request containing some kind of body (the `_`). This is probably a reasonable way to model this stuff, but for inexperienced users it becomes unwieldy quickly. When sticking to the outer edges of the Action APIs you mostly don't have to see this -- the compiler infers them for you as needed. But the Action Composition APIs force you to get involved more directly, and give you plenty of opportunities to mis-wire things, resulting in confusing compiler errors.
2. These APIs are all inheritance based, via traits, which means you have to interface with them via defining new classes or objects of your own. This leads to some extra boilerplate, and makes it hard to quickly spin up ad-hoc implementations as you go. I'm not sure I have a perfect alternative, but it would have been great to see some kind of value-oriented API that made ad-hoc composition easier.
3. As a statically typed framework, Play faces a challenge of what to do with new contextual data during Request processing.

Even if you can master enough of the type hierarchy awareness required to confidently develop around points 1 and 2, point 3 turns out to be a pretty significant hurdle in providing a convenient developer API. In dynamic language web frameworks, it's common to stuff arbitrary data into the request context. For example in a Rails controller any object can be stashed as an instance variable at any point and thus retrieved via subsequent steps. Elixir's Plug provides an [assigns](https://hexdocs.pm/plug/Plug.Conn.html#assign/3) field on its `Conn` type for a similar purpose.

Play provides a statically typed solution in the form of [WrappedRequest](https://www.playframework.com/documentation/2.8.x/api/scala/play/api/mvc/WrappedRequest.html). As the name suggests, it lets you wrap an existing request in order to tack on some new bit of data that can then be passed through to subsequent pipeline stages.

For example it's very common to see applications define a `UserRequest` for tracking the authentication state of the request:

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

Ok, makes sense I guess. So now maybe I have a `WidgetController` where I want to have a transformer to load a `Widget`. Well that could be an `ActionTransformer[UserRequest, WidgetRequest]`. And maybe widgets can also have `Order`s I want to load, so that would be `ActionTransformer[WidgetRequest, OrderRequest]`. But, what I if I also want to have a `OrderRequest` where I didn't load the widget first? Now we can see start to see the problem -- requiring concrete implementations for each variant of Request context we need to model forces us to spin up new definitions for every combination of flow we'd need. It's very challenging to do them ad-hoc.

```
UserRequest --> WidgetRequest --> WidgetOrderRequest
UserRequest --> UserOrderRequest
```

### Alternatives: EitherT and flatMap

## Other thoughts

* What about ZIO?
