---
title: "Welcome to JAR Hell"
subtitle: "Part 2: Application Deployment Strategies"
display_title: "Welcome to JAR Hell, Part 2 - Application Deployment Strategies"
layout: post
---

In [Part 1](/2021/04/04/jar-hell-part-1-compilation-classpath-libraries/), we looked at the basic model for loading and executing code on the JVM.

We saw how a Classes (usually represented by `.class` files) provide the basic unit for JVM code, and how the Classpath makes classes (usually organized into JARs) available to the JVM at compile- and runtime. And we saw how tools like Maven help us use external libraries by fetching them from package repositories and incorporating them into the local Classpath.

But what about production deployments?

The Classpath still exists regardless of whether we're running code on our Macbook or on a server in AWS, but for production, we'd prefer to run _without_ a build tool, and ideally without any system dependencies beyond a Java Runtime Environment.

In this post, we'll look at several ways to accomplish this.

### Preface: Applications vs. Libraries

Software projects can be coarsely divided into 2 groups: Libraries and Applications. Libraries are consumed by other code, while Applications are meant to run on their own. On the JVM, both types of software can be packaged as JARs, but there are some common conventions around how each gets handled.

In general, library JARs only contain a "shallow" bundle of compiled `.class` files, meaning they include _their own_ direct code but not that of their dependencies. This is sometimes also called a "skinny" JAR.

You might ask how this is useful, since if we depend on library A, and A depends on B, we obviously can't run our application without also having B. But the answer is that the developers of A expect you to retrieve B on your own after consulting A's dependency manifest (i.e. its Maven POM). When dealing with _libraries_ we prefer smaller, granular packages that can be managed programmatically by a build tool. This gives downstream users more flexibility to cache packages, handle dependency conflicts, etc.

_Applications_, by contrast, are not intended for distribution to other developers or consumption by other code. Rather, they're meant to run as standalone artifacts (e.g. they probably include a `main` method).

Applications require a deployment strategy which, one way or another, gets the application's own code, along with a fully resolved Classpath containing any necessary libraries, into the target runtime environment. This type of deployment -- running compiled applications along with their dependencies -- is what we're focused on in this article.

## Deployment for the JVM

Luckily, the JVM makes the actual "run the code" portion fairly easy -- as long as you don't get too crazy with native dependencies (e.g [JNI](https://en.wikipedia.org/wiki/Java_Native_Interface)), or shelling out to system commands, you should be able to run your app on any server with the proper [JRE](https://www.oracle.com/java/technologies/javase-jre8-downloads.html) version.

But you _do_ have to worry about getting all of the compiled code into the right place. There are a lot of ways to do this, so here is a rundown of some of the common options.

### Push and Script

For starters we can always just do a straightforward upload of the library JARs our build tool resolves for our Classpath, along with the one it has create for our own code.

For example if we're using Maven, we'll end up with a classpath / run command (locally) that looks something like `java -cp ./target/my-app.jar:~/.m2/repository/foo.jar:~/.m2/repository/bar.jar com.mycorp.MyMainClass`. So to run in prod, we have to push those same 3 JARs into our target environment, and run a `java` command with them in the same Classpath arrangement.

There are a lot of ways to achieve this, so I tend to think of it as a rough pattern more than a specific implementation.

Sbt's [native-packager plugin](https://github.com/sbt/sbt-native-packager) is a great example of a tool that does this really well. It can package all of your JARs into a Zip archive or tarball, along with a handy run script (you can see the [template](https://github.com/sbt/sbt-native-packager/blob/master/src/main/resources/com/typesafe/sbt/packager/archetypes/scripts/bash-template) for these) that will kick everything off. There are likely similar plugins for Maven or Gradle.

### Uber/Fat/Assembly JARs

As mentioned in the Libraries vs. Applications section, we've so far been dealing with "skinny" jars containing 1 project's compiled code.

In order to make a larger application work, we have to put a bunch of them side by side on the Classpath. This works fine, but can get annoying because you end up with dozens or even hundreds of JARs to cart around. What if you could just get it all onto _one_ JAR?

It turns out JARs _can_ be used (abused?) in this way, by creating what's called an "Uber" JAR (AKA "Assembly" or "Fat" JAR). An uberjar flattens out the compiled code from your project's JAR, _plus the compiled code from all the JARs on its classpath_ into a single output JAR. It's basically a whole bunch of JARs squished into one.

The benefit of this is that the final product no longer has any dependencies. Its whole Classpath is just the one resulting JAR, and your whole deployment model can consist of uploading the uberjar to production and invoking `java -jar my-application.jar`. It's sort of the JAR equivalent of building a single executable binary out of a language like Go or Rust.

The simplicity of the single-file deployment strategy has made uberjars popular in recent years. They're especially common in the Hadoop/Spark ecosystem, but get used a lot for web services or other server applications as well.

Most build tools can either build uberjars out of the box or provide a plugin for doing it: [Maven Shade Plugin](https://maven.apache.org/plugins/maven-shade-plugin/), [sbt-assembly](https://github.com/sbt/sbt-assembly), [Leiningen (built in)](https://github.com/technomancy/leiningen/blob/master/doc/TUTORIAL.md#uberjar). Consult the README for whichever of these you're using for more details.

#### Other Uberjar Topics

While the uberjar process is not conceptually so complex (unzip + rezip), in practice there are some subtleties and advanced features that can make things quite complicated, especially for larger projects. Here are a few uberjar advanced topics you may run into.

##### Resource Deduplication

In addition to the usual `.class` files, JARs can also contain other non-code files called "resources". These could be configuration files, static assets, etc., and can be accessed programmatically via Java [APIs](https://docs.oracle.com/javase/8/docs/technotes/guides/lang/resources.html).

The catch is that resource files in a JAR have to be unique (by path), so when you squash all your deps into a single uberjar, you'll likely run into conflicts that have to be resolved. Different tools have different ways of configuring this, but it's common to specify a "Merge Strategy" for handling these conflicts. For example here's [sbt-assembly's docs on the subject](https://github.com/sbt/sbt-assembly#merge-strategy).

##### Shading

Shading is a technique for dealing with certain kinds of dependency conflicts by relocating code from one conflicting version of a package into a different namespace, thus allowing it to coexist with another version of itself. Technically shading can be applied to any JAR, but it comes up a lot in the context of uberjars, because large uberjars tend to produce the kinds of conditions where shading is necessary.

Shading is a complex topic in its own right so we'll cover it more in Part 3, which focuses on dependency conflicts and classpath pathologies. In the meantime here are some good resources:

* [Java Class Shadowing and Shading](https://medium.com/@akhaku/java-class-shadowing-and-shading-9439b0eacb13)
* [Stack Exchange: What is a "shaded" Java dependency?](https://softwareengineering.stackexchange.com/questions/297276/what-is-a-shaded-java-dependency)

### WAR Files and J2EE

[WAR Files](https://docs.oracle.com/cd/E19199-01/816-6774-10/a_war.html) are a special JAR variant used for deploying certain types of Java web applications in the J2EE ecosystem. J2EE is a whole can of worms that I honestly don't know much about, nor am I very interested in learning. But it does come up a lot so it's worth touching on here.

In short, these applications are designed to deploy not to generic VMs (like a bare Ubuntu EC2 instance with `java` installed) but rather into specialized Java-based [Application Servers](https://en.wikipedia.org/wiki/List_of_application_servers#Java), like [Apache Tomcat](http://tomcat.apache.org/). Your company would run one or more of these Tomcat instances, which get treated as shared infrastructure, and individual applications get pacakged into WARs and deployed into a pre-existing App Server, probably along with a bunch of other application WAR files.

The Application Server manages your app's lifecycle, along with providing some shared system services, and because of these interactions extra care must be taken to ensure the 2 components cooperate well, which is what the WAR spec provides.

[This article](https://javapipe.com/blog/tomcat-application-server/) gives a good overview of this whole system. [Here's another good one](https://octopus.com/blog/application-server-vs-uberjar) about WARs specifically.

Despite my skepticism and poorly masked disdain for all this, it is kind of amusing to read about. If you squint right, running WARs via Tomcat isn't so different from running "pods" of "containers" on abstracted machines via kubernetes, just with a lot more enterprise-y pocket protector vibes.

And the decline of one is certainly related to the rise of the other -- while there are plenty of J2EE deployments running out there, much of the industry has moved away from this model. These days people care more about cloud portability and deployment standardization (e.g. running with Docker or deploying via the [12 Factor Model](https://12factor.net/)). This makes highly customized, language-specific infrastructure less appealing than a giant uberjar you can run with a single `java -jar` command.

### Docker and Container Images

Ironically one of Java's initial selling points -- simplicity of deployment -- has been somewhat diminished by the proliferation of Docker. Now that everyone's prod environments are "BYO Container" anyway, the benefit of just putting the JRE on all your servers doesn't matter as much.

Nevertheless, the JVM runs just fine in Docker, and in many cases, you can grab an appropriate base image (like [OpenJDK](https://hub.docker.com/_/openjdk)), stuff your JARs into it, and go.

However it's worth emphasizing: using Docker doesn't change the fundamental JVM equation of Java Runtime + Classpath full of JARs = Application. The only difference is now the base image provides the JRE, and you'll be loading your Classpath JARs into a container image rather than onto a bare server or VM.

So usually you'll be putting into your Docker image some variation of one of the previous models:

* Put your compiled code and all your dependencies into a docker image and include an entrypoint command that invokes them with the proper settings and Classpath. Basically the "Push & Script" strategy but in Docker. (sbt's [native-packager](https://www.scala-sbt.org/sbt-native-packager/formats/docker.html) plugin does this)
* Build an uberjar and put it in a JDK docker image. Your Dockerfile `CMD` setting will be something like `java -jar /path/to/that.jar`
* Use a dedicated Java-to-Container build plugin like [Google's Jib](https://github.com/GoogleContainerTools/jib).

#### Jib: Java-specific Container Image Builds

[Jib](https://github.com/GoogleContainerTools/jib) is an interesting new project providing a pure-Java build tool for the [OCI Image Spec](https://github.com/opencontainers/image-spec). This is interesting for a few reasons.

First, because it's implemented in Java, Jib integrates into existing JVM build tools. Normally, running `docker build` requires an RPC connection to a Docker daemon process on your machine. You need to have Docker installed, and the build process has to copy things back and forth between the daemon and the docker client. Jib allows you to sidestep all this and keep things entirely within your Maven or Gradle build.

Second, by targeting Java applications specifically (rather than providing a general-purpose container build tool) Jib is able to make some interesting optimizations like:

* Using [distroless](https://github.com/GoogleContainerTools/distroless) base images that contain _only_ the JVM (not even a full OS!) which makes your images a lot smaller
* Taking better advantage of image layering by splitting your dependencies (which tend to change less) into a separate layer from your classes (which change often). This gives you faster incremental builds since most builds only require re-building the smaller application layer.

Thanks to these tricks, Jib images can often be smaller and build faster than traditional Docker builds.

More info on Jib:

* [Jib presentation from Oreilly Velocity 2018](https://www.youtube.com/watch?v=H6gR_Cv4yWI)
* [GCP Blog Post on JVM Containerization Options](https://cloud.google.com/blog/topics/developers-practitioners/comparing-containerization-methods-buildpacks-jib-and-dockerfile)
* [Baeldung on using Jib](https://www.baeldung.com/jib-dockerizing)

### GraalVM Native Images

[GraalVM](https://www.graalvm.org/) is an alternative JVM runtime with some really interesting features, one of which is the ability to do Ahead-of-Time compilation of JVM bytecode.

Traditionally, the JVM uses a JIT compiler to turn bytecode into native machine code at runtime. But Graal lets us do this at build time, which opens up the possibility of packaging JVM applications into self-contained, platform-specific executables, called [Native Images](https://www.graalvm.org/reference-manual/native-image/).

A native image includes all of your application's code, its dependencies, plus the necessary Java Runtime bits like the standard library and the garbage collector. It's all there in one standalone binary package, so you don't even need to have `java` installed anymore.

Because the runtime doesn't have to JIT all your code at startup, the resulting program also starts _much_ faster and requires less memory than traditional JVM programs, making it interesting for use cases like CLI utilities where the JVM previously was not a great fit.

While JVM CLIs are cool, the Industry is mostly excited about native images for a different reason: **Serverless**.

Everyone wants to stuff their Java programs into a Lambda/Cloud Run/whatever function and use them on-demand, but this doesn't work well if your bloated app takes 30 seconds to boot. So native image provides a path to running Java programs in these environments.

So what's the catch? Well there are 2 main ones:

1. Restrictions of the native image AOT process mean that some runtime features like reflection don't work well or at all. In some cases there are workarounds but YMMV. [Consult the docs](https://www.graalvm.org/reference-manual/native-image/Reflection/). (**Side note**: Ironically this has led to a wave of backpedalling across the industry, as everyone scrambles to get things like Spring running without reflection. Suddenly reflection is bad and compile time abstractions are cool in Java.)
2. So far, native image performance is at [least different, and generally slightly worse](https://github.com/oracle/graal/issues/1069#issuecomment-473649871), than traditional JVMs. The AOT process is able to make fewer optimizations than the traditional JIT, so your "warmed up" throughput will usually be worse. There are some workarounds, like [PGO](https://www.graalvm.org/reference-manual/native-image/PGO/), and this landscape continues to evolve, so again, do your research.

## Summary

So there's your crash course in JVM app packaging. There are a ton of details surrounding this topic, so we've inevitably had to skip over a lot. But hopefully it provides enough of an overview of the landscape, and provides a jumping off point to make informed further research elsewhere.

What's next? I'm sure you must be thinking: "*Wow, with a rock-solid runtime and so many great deployment options, surely everything must work perfectly in production?*"

Ha! If only! Just whisper the words `ClassNotFoundException` to a Java developer and see how they react.

Unfortunately, it does not, in fact, all work perfectly in production. To learn more about this, stay tuned for **Part 3**, in which we will descend into Classpath Hell, and hopefully emerge singed, but enlightened.
