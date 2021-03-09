### Annoyance 1: Don't let the framework take over

Like any big framework, it's easy for Play's APIs and machinery to seep deeply into your domain model. This is maybe even more annoying in Play, since it's also fairly "unopinionated" when it comes to model + persistence logic, so you're not getting as much in exchange for your ecosystem lock-in as you do in something like Rails.

#### Solution

Fortunately there are well-established software patterns for dealing with this problem. A common one is the [Hexagonal Architecture](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)) or "Ports and Adaptors" pattern.

In short, develop your core domain logic in isolation of external interfaces like Web APIs or CLIs. Then when you need to add these features to your project, have the web layer consume your core application as if it were a library, providing the domain-level APIs you need to drive the system (fetching persisted records, initiating asynchronous workflows, etc).

An easy way to do this in Scala is to use [sbt subprojects](https://www.scala-sbt.org/1.x/docs/Multi-Project.html) to isolate your core domain from your web interface layer.

I have one project **"core"**, which contains the domain (including persistence logic, asynchronous task management, external service integrations, etc). This project has 0 `play-*` dependencies, and can be compiled and tested in isolation.

Then I have a separate **"web"** project which depends on the core one. In my application Loader I initialize an instance of the core application, and pass it through as a dependency to the various web components that need it, just like I would any other 3rd party library. It's a first party library!

### Annoyance 1.5: All the Java + DI stuff

I'm not really aware of the history here but IMO the decision to add dedicated Java APIs and move to things like Guice weakened the APIs and dev experience for Scala users. And it's hard to imagine this has led to a ton of success in reaching out to the enterprise-y Java crowd. Are people really using Play in Java when there are so many more mainstream options like Spring Boot, Micronaut, etc? It feels like a bit of a misstep to me.

#### Solution

Luckily this one is pretty easy to avoid as well: just don't use Guice and all the DI stuff. I don't use it in my web code, and I would _definitely_ not let it into my core domain code.

I personally just construct my controller instances in my app loader manually. It's OK. You are allowed to pass arguments without involving a huge enterprise framework.

```scala
// Just wiring up my stuff...
val collectionController = new CollectionController(controllerComponents, actorSystem)
val authController = new AuthController(oauth, myApp, controllerComponents)
val apiController = new ApiController(cc, assets)
// Note that the order these are passed is determined by the order they appear in your routes file
val router: Router = new router.Routes(
  httpErrorHandler,
  collectionController,
  collectionSettingsController
)
```

If you find this intolerable, look into [macwire](https://github.com/softwaremill/macwire), which also seems to be pretty popular for this use-case.



My biggest day to day issues working with the framework have stemmed from the [Action Builder](https://www.playframework.com/documentation/2.8.x/ScalaActionsComposition) API. These abstractions are intended to help you generalize common patterns in request handling, and while it's a fairly narrow section of Play's toolkit, the problems they solve are pretty fundamental to managing complexity in a web app.
