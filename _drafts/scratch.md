### Scratch

Many languages nowadays offer a clearly sanctioned build tool ([Bundler](https://bundler.io/) for Ruby, [Cargo](https://doc.rust-lang.org/cargo/) for Rust, etc), Java predated these conventions, and Maven was the community tool that eventually brought them to the JVM.

Maven codified the evolving conventions around distributing JVM code as libraries and expressing dependencies between them.



as well as other metadata about a package using a `pom.xml` file (sometimes written as `<package>-<version>.pom`).



but Maven has become a lingua franca in the ecosystem, and other tools generally support both consuming and producing Maven-style POMs and JARs.

 is a well-known public repository for publishing Maven-style libraries, and there are many commercial and OSS tools for hosting your own repository, which many companies use internally for private packages.

https://repo1.maven.org/maven2/works/worace/circe-geojson-core_2.12/0.2.0/

So now we can:

* Compile source code into `.class` files
* Bundle multiple compiled sources into an archive (JAR)


Well, I wish I could explain to 1995 James Gosling that I'm about to upload 4.2GB of `.class` files to the servers of an online bookstore in the hopes that they'll run them on my behalf.




The actual loading of compiled `.class` files into memory is accomplished by another component, called a [Classloader](https://www.baeldung.com/java-classloaders) which is mostly beyond the scope of this discussion, but provides yet another layer of subtlety in the whole process.


All of this can get quite complicated, so it's generally managed by...


"Write once, run anywhere," they said. "It'll be fun," they said. Well I once wrote some code and now I'm still waiting for 4.2GB of `.class` files to upload to the servers of an online bookstore so I can run it. I wish I could explain that to 1995 James Golick.



### Build Tool 101

Build tools are complicated beasts because they do a lot of different things. But some of the most basic ones 

 Most projects put these under a directory like `src/main/resources/blah.txt`, which will get bundled into the top level of the JAR like `/blah.txt.


I did not know at the time, but my nascent love of parentheses and immutable data structures was a slippery slope into grudging familiarity with the JVM as a platform. One of the many things I've absorbed through osmosis on this journey is an understanding of the JVM app packaging model. In recent years I've worked with JVM code in Clojure, Scala, Ruby (JRuby), Javascript (Nashorn - don't ask), and occasionally I even write some Java. While they all have their own quirks, one common theme is a shared reliance on the JVM packaging and library distribution model for reusing and deploying code.


This is Part 1 of a 2-part series. This section covers some of the basics of the JVM's compilation and packaging model, so if you're a veteran who's been writing Ant scripts since 2001, it may not be fo much use for you. In Part 2, we'll look at some more advanced topics and in particular discuss some of the problems that arise especially when managing dependencies for larger JVM projects.


If you're a newcomer to the JVM or if you just have the particular type of brain worms that motivate you to read 5000 words about JARs, Classpaths, POMs, this may be of interest. In either case I am sorry for you.

 (As a Clojure enthusiast, I certainly did not realize my nascent love of parentheses and immutable data structures would eventually lead to a deep understanding of Classpath management.)

This is less about performing specific build tasks with Maven, and more about developing. It also includes a bit of narrative history for how these approaches evolved which sometimes helps in understanding how things got to be the way they are.

If

I hope to follow up with a Part 2, which will cover more advanced topics such as the many ways your Classpath can get screwy when deploying large projects.


## javap

If you want to see a more thorough explanation of how this looks to the JVM, you can actually interrogate it with `javap`:

```
$ javap -p -v Hello.class
Classfile /Users/worace/Dropbox/scratch/jar-hell/Hello.class
// ...
{
  public Hello();
    // ...
  public static void main(java.lang.String[]);
    descriptor: ([Ljava/lang/String;)V
    flags: ACC_PUBLIC, ACC_STATIC
    Code:
      stack=2, locals=1, args_size=1
         0: getstatic     #2                  // Field java/lang/System.out:Ljava/io/PrintStream;
         3: ldc           #3                  // String Hello
         5: invokevirtual #4                  // Method java/io/PrintStream.println:(Ljava/lang/String;)V
         8: return
      LineNumberTable:
        line 3: 0
        line 4: 8
}
```

Again, the meaning of all that is beyond the scope of this article, but if you're interested in JVM internals you can read up on [it](https://book.huihoo.com/the-java-virtual-machine-specification/first-edition/ClassFile.doc.html) [elsewhere](https://dzone.com/articles/java-virtual-machine-internals-part-2-class-file-f).


## Build Tools: Ant, Maven, et al.

* Ant: Make-like build tool engine
* Maven: convention-based workflows
  * `pom.xml`
* compile code to class files
* bundle class files into JARs


## Packaging and Deploying an Application

Using build tool to:

* Resolve and Fetch dependencies
* Compile
* Create a distributable archive
* Distribution strategies:
  * Zip/Tar/etc of Classpath
  * Uberjar
* Java EE "Application Servers"
  *
* Docker
  * While the JVM obviates some of the common motivations for using Docker, they work perfectly well together. The process is mostly the same: resolve and fetch dependencies, compile your code, then bundle the compiled code + dependencies into an image. And since many JVM applications have pretty narrow system requirements these images can be quite simple -- often an Alpine base image + a JRE is all you need.

### Bonus Round: GraalVM Native Image


## Uberjars


The actual loading of `.class` file to in-memory Class representation is handled by another component, called a [ClassLoader](https://docs.oracle.com/javase/7/docs/api/java/lang/ClassLoader.html), which is also out of the scope of this discussion.

 This is precisely the "scp our `.class` directory to a server" model we just described, but wrapped in a more presentable package.

JAR files have a bunch of other niche features (special Applet support, Service loader configuration, content signing, indexing schemes to speed up class loading, etc), but for most of us they're just a standard way to package and distribute (compiled) JVM code.



So your Classpath can be composed of raw `.class` files, like the examples we saw earlier. But for distribution and deployment use cases it's more common to use JARs.


(e.g. [Mix](https://hexdocs.pm/mix/Mix.html) for Elixir or [Cargo](https://doc.rust-lang.org/cargo/) for Rust),
Then there was a generation of "Build-a-Build" build tools, most famously [Ant](https://ant.apache.org/), which provided Make-like utilities for scripting common compilation and JAR management tasks, but were fairly low-level and encouraged a lot of customization.

While many languages nowadays launch with a sanctioned dependency management solution from day 1, Java predated these conventions, and it took time for the ecosystem to coalesce around a standard. 

In the very early days, people tended to manage library distribution by hand, via shell scripts, FTP servers, or even just emailing JAR files around.

* What are all these `$` in my `.class` names
* Build tool 101


## FAQ / TODO

* Do we really need all this stuff?
* Why don't JARs handle library manifests directly
* Why does my java project have 30 levels of nested directories? Project organization conventions `src/main/scala/...` + resources
* Provided scope
* Shading
* Java 9 / Module System
* Other types of uberjars

### Resources

* https://www.javapubhouse.com/2015/01/episode-47-stop-maven-time.html
* https://manifest.fm/6

# Part 2: Classpath Hell and Managing Dependencies in Large Projects

The JVM has become a big tent in recent years.

There are definitely still veterans around who have lived through Applets and J2EE and all the rest, but there are also a lot of newcomers, who stumbled into the JVM unwittingly because of Clojure, or because of Spark, or Android, or whatever.

For those of us who didn't come in through the traditional Java developer path, there are a lot of JVM nuances like GC tuning, package mangement, etc that you have to absorb over time.


as an application deployment mechanism, where the final target is not a package repository or local development task, but some production server environment. In these cases, you no longer care about granularity or redistribution -- you just want the simplest means possible of getting the `.class` files needed for your project into production. One approach to this is building 

Honestly if you can get through this stuff without falling into a stupor and drooling on your keyboard, congrats.


It's kind of amusing to read about this stuff nowadays, because it honestly has a lot of similarities to modern RPC-based microservice architectures, . The components are isolated from one another, except that they're kind of not, because they have lots of interdependencies to actually do anything, 


The format of a `.class` file is defined by 

Java Class? `Class`.
, which contains bytecode representation of a single JVM Class. 

As in Java, everything on the JVM is a class, or at least class-like, 

The JVM doesn't consume raw `.java` sources but rather compiled `.class` files, which contain bytecode instructions in the JVM instruction set. You can read more about the  and the [ClassFile](https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-4.html) specification elsewhere, but in short they provide a binary representation of the code for a Class, including its fields, constructors, methods, etc.

The JVM Class model aligns closely with that of the Java language, but they're not fundamentally linked. Thanks to this separation, the many [alt-JVM languages](http://openjdk.java.net/projects/mlvm/summit2019/) are able to compile their own code into JVM bytecode, and get access to the JVM's excellent runtime for free.

When the Scala compiler turns an [anonymous lambda expression into JVM bytecode](https://www.toptal.com/scala/scala-bytecode-and-the-jvm), it may do things that we would not think of as very "class-like", but it's still following the same model, with the same rules and binary format.

but how do we get external JARs to depend on? We could record a list of dependencies, along with where we found them on the internet, and ask each new team member to go and download them to their own machine.

We like dependencies because we are lazy programmers who want to have work already done for us, but they can add a lot of complexity

We mentioned that one use case for a JAR is to pull in external code written by another developer. We call 3rd party JARs like this "libraries" or "dependencies", and . But how do we get external JARs to depend on? We could record a list of all our dependencies, along with where we found them on the internet, and whenever a new person joins the project they can go and download them to their own machine. However this is error-prone, not to mention the fact that our dependencies might have _their own dependencies_, so you can see how the whole thing starts to spiral out of control. We need more tooling.

 so while it's common for newer languages to ship with dependency tools from day 1,


predated many of these conventions and it took time for the JVM community to coalesce around an approach.

Because the Application Server handles the orchestration and lifecycle of your individual App

The application server handles the process of orchestrating your application (no `java -jar MyApp.jar` here), as well as providing a bunch of [common J-* branded system services](https://en.wikipedia.org/wiki/Jakarta_EE#Web_profile). Because of all this, there are extra considerations around packaging and deployment to make sure the 2 systems (your application and the hosting Application Server) play nicely together, and that's where the WAR spec comes in.


#### Uberjar Gotcha: Resource Deduplication

In addition to compiled `.class` files, JARs can also include other non-code files called "resources". These could be configuration files, static assets, etc., and can be accessed programmatically via Java [APIs](https://docs.oracle.com/javase/8/docs/technotes/guides/lang/resources.html).

The catch is that resource files in a JAR have to be unique, so when you squash all your deps into an uberjar, you'll have to resolve these conflicts. Different tools have different ways of configuring this, but it's common to specify a "Merge Strategy" for handling these conflicts. For example here's [sbt-assembly's docs on the subject](https://github.com/sbt/sbt-assembly#merge-strategy).

If you're on AWS and EC2, Netflix has done a lot of work around automating deployments via [AMIs](https://github.com/Netflix/aminator), and has released some tooling (e.g. [Nebula](https://nebula-plugins.github.io/documentation/introduction_to_nebula.html)) to do this for Java applications.

There's also always the tried and true [Heroku approach](https://devcenter.heroku.com/articles/java-support#activation), of cloning your source tree onto your prod server, running the build process _there_, then launching your server process from the resulting artifacts. The downside to this is that it requires extra dependencies in your prod environment (you need your build tools in addition to just the Java runtime), but it works fine in many cases. (Worth noting that Heroku supports deploying Java apps via [pre-built JARs](https://devcenter.heroku.com/articles/deploying-java-applications-with-the-heroku-maven-plugin) as well.)


The point is there are a bunch of options here, depending on what platform or build tool you're working with. But they all share the same rough goal of 1) using a build tool to fetch deps, resolve a Classpath, and compile code, 2) pushing those artifacts to a prod server, and 3) passing it all off to the appropriate `java` command.

, and it's great when distributing code for other developers to consume (for example publishing a library into a package repository), or if you're going to be running the code along with all of the other JARs on the Classpath (like what happens with `mvn test`, etc).
