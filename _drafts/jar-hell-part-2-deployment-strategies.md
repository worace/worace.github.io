We've seen how this works locally, but what about deployment?

Luckily, the JVM makes this fairly easy -- as long as you don't get too crazy with native dependencies (e.g [JNI](https://en.wikipedia.org/wiki/Java_Native_Interface)), or shelling out to system commands, you should be able to run your app on any server with the proper [Java Runtime Environment](https://www.oracle.com/java/technologies/javase-jre8-downloads.html) version.

All we need to do is get this pile of `.class` files we've accumulated into the right place, and there are a couple common ways to do that.

## TODO NEED A TRANSITION HERE

### Zip, Push, and Script

One common approach involves doing a straightforward upload of all the JARs your build tool has resolved for your Classpath, along with the one it has created for your actual code, onto your production environment. Then, in production, you would invoke the appropriate `java` command, along the lines of `java -cp <My application JAR>:<all my library JARs> com.mycorp.MyMainClass`. Often people will wrap this last bit in some kind of generated script that makes it easier to get the Classpath portion right.

There are a lot of different ways to achieve this, depending on what platform you're targeting and what build tool you're using. Sbt's [native-packager plugin](https://github.com/sbt/sbt-native-packager), for example, can package all of your JARs into a Zip archive or tarball, along with a handy run script that will kick everything off. (For those keeping score, yes, we're now putting JARs, which are rebranded Zip archives, into other Zip archives). There are likely similar plugins for Maven or Gradle.

### Uber/Fat/Assembly JARs

The JARs we've seen so far only contain the compiled `.class` files for their own direct source code, which is sometimes referred to as a "skinny" JAR. Skinny JARs are good from a library management perspective because they keep things granular and composable, but they can be annoying at deployment time because you end up with dozens or even hundreds of JARs to cart around. What if you could just get it all onto _one_ JAR?

It turns out JARs _can_ be used (abused?) in this way, by creating what's called an "Uber", "Assembly", or "Fat" JAR. An uberjar flattens out the compiled code from your project's JAR, _plus the compiled code from all the JARs on its classpath_ into a single output JAR. It's basically a whole bunch of JARs squished into one.

The benefit of this is that the final product no longer has any dependencies. Its whole Classpath is just the one resulting JAR, and your whole deployment model can consist of uploading the uberjar to production and invoking `java -jar my-application.jar`. It's sort of the JVM equivalent of building a single executable binary out of a language like Go or Rust.

Most build tools either have this built in or provide a plugin for doing it: [Maven Assembly Plugin](http://maven.apache.org/plugins/maven-assembly-plugin/), [sbt-assembly](https://github.com/sbt/sbt-assembly), [Leiningen (built in)](https://github.com/technomancy/leiningen/blob/master/doc/TUTORIAL.md#uberjar). Consult the README for whichever of these you're using for more details on setting them up.

Uberjar deployments are especially common in the Hadoop/Spark ecosystem, but get used a lot for web services or other server applications as well.

#### Other Uberjar Topics

Uberjar configuration can get complicated, so depending on your use case there are bunch of variations you can add to this approach:

* [Resource deduplication](https://github.com/sbt/sbt-assembly#merge-strategy) - "Resources" (non-code auxiliary files) in a JAR have to be unique, so when building an uberjar, you often have to configure a strategy for merging any conflicts that occur
* [Shading, a way to relocate private copies of a Class to deal with conflicts](https://maven.apache.org/plugins/maven-shade-plugin/examples/class-relocation.html)
* [Uberjar variants](https://dzone.com/articles/the-skinny-on-fat-thin-hollow-and-uber)

### WAR Files and J2EE

[WAR Files](https://docs.oracle.com/cd/E19199-01/816-6774-10/a_war.html) are a special type of JAR variant used for deploying certain types of Java web applications in the J2EE ecosystem. J2EE is a whole can of worms that I honestly don't know that much about, nor am I very interested in learning. But it does come up a lot so it's worth touching on here.

In short, these applications are designed to deploy not to generic VMs (like a bare Ubuntu EC2 instance with `java` installed) but rather into specialized Java-based [Application Servers](https://en.wikipedia.org/wiki/List_of_application_servers#Java), like [Apache Tomcat](http://tomcat.apache.org/). Your company would run one or more of these Tomcat instances, which get treated as shared infrastructure, and individual applications get pacakged into WARs and deployed into a pre-existing App Server, probably along with a bunch of other application WAR files. The Application Server manages your app's lifecycle, along with providing some shared system services, and because of these interactions extra care must be taken to ensure the 2 components cooperate well, which is what the WAR spec provides.

[This article](https://javapipe.com/blog/tomcat-application-server/) gives a good overview of this whole system. [Here's another good one](https://octopus.com/blog/application-server-vs-uberjar) about WARs specifically.

Despite my skepticism and poorly masked disdain for all this, it is kind of amusing to read about. If you squint right, running WARs via Tomcat isn't so different from running "pods" of "containers" on abstracted machines via kubernetes, just with a lot more enterprise-y pocket protector vibes.

And the decline of one is certainly related to the rise of the other -- while there are plenty of J2EE deployments out there, much of the ecosystem has moved away from this model. These days people care more about cloud portability and deployment standardization (e.g. the [12 Factor Model](https://12factor.net/)), which makes highly customized, language-specific infrastructure less appealing than a giant uberjar you can run anywhere with a Java runtime.

### Container Images

Ironically one of Java's initial selling points -- simplicity of deployment -- has been somewhat diminished by the proliferation of Docker. Now that everyone's production environments are built around a Bring Your Own Container model of customization, the benefit of just putting the JRE on all your servers doesn't matter as much.

Nonetheless, the JVM runs just fine with Docker, and in many cases, you can simply grab the appropriate [OpenJDK](https://hub.docker.com/_/openjdk) image version, stuff your JARs into it, and go.

Usually you'll be putting into your Docker image some variation of one of the previous models:

* Build an uberjar and put it in a JDK docker image
* Put your compiled code and all your dependencies into a docker image and include an entrypoint command that invokes them with the proper settings and Classpath (sbt's [native-packager](https://www.scala-sbt.org/sbt-native-packager/formats/docker.html) plugin does this)
* Use a dedicated Java-to-Container build plugin like [Google's Jib](https://github.com/GoogleContainerTools/jib). Jib is interesting because it's implemented in pure Java and thus can integrate directly into your build tool without requiring an external Docker process.

### GraalVM Native Image

[GraalVM](https://www.graalvm.org/) is an alternative JVM runtime with some really interesting features, one of which is the ability to do Ahead-of-time compilation of JVM bytecode into self-contained, platform-specific executables, called [Native Images](https://www.graalvm.org/reference-manual/native-image/). A native image includes your application's code, its dependencies, plus the standard library as well the core runtime utilities like the garbage collector. It's all there in one standalone binary package, so you don't even need to have `java` installed anymore. The resulting program also has _much_ faster startup time and lower memory requirements than traditional JVM programs, making it interesting for use cases like CLI utilities where the JVM previously was not a great fit.

While CLI tools are cool, the Industry is mostly excited about this because of serverless. Everyone wants to stuff their Java programs into a Lambda/Cloud Run/whatever function and use them on-demand, but this doesn't work well if your bloated app takes 30 seconds to boot. So native image provides a path to running Java programs in these environments.

So what's the catch? Well there are 2 main ones:

1. Restrictions of the native image AOT process mean that some traditional JVM tricks like runtime reflection don't work. There are sort of workarounds for this.
2. So far, native image performance is at [least different, and generally slightly worse](https://github.com/oracle/graal/issues/1069#issuecomment-473649871), than traditional JVMs. The AOT model cuts into the optimizations that can be done at runtime (you don't get that sweet sweet JIT), so your "warmed up" throughput will usually be worse. However this is still evolving, and there are [workarounds](https://www.graalvm.org/reference-manual/native-image/PGO/), so do your research.

Ironically point number 1 has lead to a huge wave of backpedalling across the industry, as everyone tries to get things like Spring running under native image. Suddenly reflection is bad and compile time abstractions are cool in Java.

## Summary

So there's your crash course in JVM packaging. There are a ton of details surrounding this topic, so we've inevitably had to skip over a lot. But hopefully it provides enough of an overview to understand how the pieces fit together, and make informed further research elsewhere.

What's next? I'm sure you must be thinking, "Wow, with such a robust packaging system surely everything must work perfectly in production?" Ha! If only! Just whisper the words "ClassNotFoundException" to a Java developer and see how they react.

Unfortunately, it does not, in fact, all work perfectly in production. To learn more about this, stay tuned for **Part 2**, in which we will descend into Classpath Hell, and hopefully emerge singed, but enlightened.
