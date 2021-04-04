---
title: "You're in the JARmy now"
subtitle: "An eager neophyte's guide to JVM packaging (Part 1 of 2)"
layout: post
---

The JVM is a big tent. Maybe you're a seasoned veteran who's lived through everything from Applets to J2EE. Or maybe you're a weirdo like me who came in through Clojure, only to find that love for parentheses and immutable data structures was a slippery slope into Classpath troubleshooting.

This article is targeted at the latter group, and aims to provide a crash course in JVM app packaging for newcomers to the platform. We'll cover compilation basics, JARs, `pom.xml`, and deployment strategies. This is less about accomplishing tasks with a specific build tool and more about developing a mental model for how code gets packaged and distributed on the JVM.

Stay tuned as well for Part 2, which will cover more advanced topics such as the many ways your Classpath can get screwy when deploying large projects.

## Java and the JVM Class Model

As you may recall from "Java 101", Java code runs on the **J**ava **V**irtual **M**achine. These days, the JVM has evolved into a powerful [polyglot runtime](http://openjdk.java.net/projects/mlvm/summit2019/) that we use to host a variety of non-Java languages. But it was originally created expressly for the purpose of running Java, and the 2 share a lot of common characteristics.

On the JVM, as in Java, _everything_ is a class, and the fundamental unit of code for the JVM is a `.class` file. The JVM won't run `.java` (or any other language) source files directly, they must first be turned into `.class` files by a compiler.

Java Class? Turned into a `.class`. Scala [Anonymous Function](https://www.toptal.com/scala/scala-bytecode-and-the-jvm)? Given a funny name and turned into a `.class`.
Clojure macro? Expanded by the Clojure compiler, purified with the blood of a goat, mixed into a namespace, and [turned into a `.class`](http://blog.kdgregory.com/2016/05/how-and-when-clojure-compiles-your-code.html).

A Classfile contains a binary representation of a class, following a structure defined by the [JVM Spec](https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-4.html). It includes slots for Class-y things like constructors, constants, fields, and methods. Most importantly, it contains our actual code, represented as [JVM Bytecode](https://en.wikipedia.org/wiki/Java_bytecode), which describes code using the JVM's internal [instruction set](https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-6.html), which is analogous to the machine-level instruction set that would be hardwired into your [x86](https://en.wikipedia.org/wiki/X86_instruction_listings) or [ARM](https://en.wikipedia.org/wiki/ARM_architecture#Instruction_set) CPU.

Of course, this is just scratching the surface of a complex topic full of nuances and exceptions. For one thing the conventions and state of the art around these things are constantly changing (newer versions of Scala actually _don't_ generate [standalone classes for anonymous functions](https://www.scala-lang.org/news/2.12.0/#java-8-style-bytecode-for-lambdas) because they use Java 8's [invokedynamic](https://www.infoq.com/articles/Invokedynamic-Javas-secret-weapon/) instead). And for another there are always exceptions (you can in fact generate Bytecode at runtime rather than including it in a pre-compiled `.class` file, something that dynamic languages like JRuby [do a lot of](https://realjenius.com/2009/10/06/distilling-jruby-the-jit-compiler/)).

But, in general, especially if you're working in a statically compiled language like Java or Scala, most things will get turned into a `.class` file at compile time. As we'll see, managing the generation, organization, and interaction of Classfiles is one of the fundamental tasks for JVM build tools and deployment workflows, so keeping them in mind is a useful model to understand how these processes work.

## Making `.class` files

In practice we usually deal with `.class` compilation through build tools, but the simplest way to produce one is by invoking `javac` (or another JVM lang compiler) directly:

```java
// Hello.java
public class Hello {
  public static void main(String[] args) {
    System.out.println("Hello, World!");
  }
}
```

```
$ javac Hello.java

$ ls
Hello.class     Hello.java

$ java Hello # run our newly compiled program
Hello, World!
```

`javac` compiles our `Hello.java` source into a corresponding `Hello.class`. When we run a java command like `java Hello`, the `Hello` we're specifying is actually the name of a Class, and the JVM has to go and fetch it in order to execute the code it contains.

## Classloading and the Classpath

Just as your shell has a `PATH` variable which tells it where to look for executables, the JVM uses a similar setting, called the ["Classpath"](https://docs.oracle.com/javase/tutorial/essential/environment/paths.html), to determine where to find `.class` files corresponding to new classes. The Classpath is a simple concept, but it's fundamental to how real-world JVM applications run (or, frequently, crash due to Classpath problems).

By default the Classpath is simply `"."`, the current directory. Our previous example works because the `Hello.class` definition matching the class named `Hello` (`.class` files are named for the Class they contain) is sitting in the current directory, which is on the Classpath, and the JVM is able to find it.

### Package and Directory Conventions


So we can compile and run a trivial example with 1 class, but what about when there are more of them, and they want to interact?

In practice, Java code is usually organized into packages (that's the `package com.mycorp.foo` you see at the top of all your company's Java files), and there's a [convention](https://docs.oracle.com/javase/tutorial/java/package/managingfiles.html) of expecting `.class` files on the Classpath to be organized in a directory structure that matches their package hierarchy.

So, a more realistic example of a simple source / class tree might be:

```java
// ./example/Pizza.java
package example;

import example.Calzone;

public class Pizza {
  public static void main(String[] args) {
    System.out.println(Calzone.yum);
  }
}
```

```java
// ./example/Calzone.java
package example;

public class Calzone {
  public static String yum = "yummm";
}
```

Now we have 2 classes interacting via an import. We can compile the whole structure:

```
$ javac example/*.java
$ tree .
.
└── example
    ├── Calzone.class
    ├── Calzone.java
    ├── Pizza.class
    └── Pizza.java
```

And execute it:

```
$ java example.Pizza
yummm
```

This loads 2 of our classes: `example.Pizza`, which we triggered explicitly, and `example.Calzone`, which `example.Pizza` imports. In both cases, the JVM is able to find these by traversing the classpath (`"."`, the default) to find the corresponding class files (`Pizza.class` and `Calzone.class`, matching their class names) under the directory (`./example/`) which corresponds to their package name.

## Packaging Classes into JAR Files

So using manual `javac` commands and some careful directory organization, we can produce a Classpath which gives the runtime what it wants:

* One (or more) searchable base directories containing...
* Class files organized into subdirectories according to their package hierarchy

If needed, we could even wire up a crude deployment system from this by just `scp`-ing our whole directory to a server, `ssh`-ing into it, and running `java Foo`. And JVM code certainly _can_ be deployed this way.

But, carting around `.class` trees manually gets tedious, so they created a specification for packaging them into more organized bundles, called [JAR files](https://docs.oracle.com/javase/8/docs/technotes/guides/jar/jarGuide.html).

A JAR is basically a Zip archive (you can literally unpack them with `unzip`) containing a tree of class files along with some metadata. You can see how they work yourself by pulling one from a public package archive and unpacking it:

```
$ wget https://repo1.maven.org/maven2/ch/hsr/geohash/1.3.0/geohash-1.3.0.jar
$ unzip geohash-1.3.0.jar
Archive:  geohash-1.3.0.jar
   creating: META-INF/
  inflating: META-INF/MANIFEST.MF
   creating: ch/
   creating: ch/hsr/
   creating: ch/hsr/geohash/
   creating: ch/hsr/geohash/util/
  inflating: ch/hsr/geohash/util/VincentyGeodesy.class
  inflating: ch/hsr/geohash/util/LongUtil.class
  # etc...

$ tree ch
ch
└── hsr
    └── geohash
        ├── GeoHash.class
        └── util
            ├── LongUtil.class
            └── VincentyGeodesy.class
            # etc...
```

Everything under `META-INF/` is metadata describing the packaged code, while the tree of class files corresponds to the compiled representations of the Java sources you can find [here on github](https://github.com/kungfoo/geohash-java). If you examine the code in that repo, you'll see the package names and source directory structure match the `.class` tree in this JAR, just like our `example.Calzone` and `./example/Calzone.class` tree matched before.

Many JVM tools understand JARs, meaning you **can use them directly as part of your classpath**:

```bash
# Launch the scala repl with this JAR on the classpath
# and import a class it contains
$ scala -classpath geohash-1.3.0.jar
scala> import ch.hsr.geohash.GeoHash
import ch.hsr.geohash.GeoHash
```

As with your shell's `$PATH` variable, you can include multiple Classpath entries by separating them with `:`. For example, if your project depended on several external libraries, you could utilize them all like this: `java -cp /path/to/lib1.jar:/path/to/lib2.jar:/path/to/lib3.jar com.example.MyClass`.

But, managing lists of JARs for a Classpath by hand also gets tedious, so in practice most of this generally gets done using a build tool...

## From ClassFiles in a trenchcoat to genuine dependency semantics

On the JVM, a "library" or "dependency" is 3rd party code (as usual, packaged in a JAR) which we want to use in our own projects. As lazy programmers we love the idea of having code already written for us, but unfortunately managing dependencies for software projects can get complicated.

We identify the libraries we want to use and figure out where on the internet to find them, only to then discover that our dependencies _have dependencies of their own!_ So the whole thing has to be repeated down a potentially very complex tree. We need another level of tooling to manage this for us.

In fact, Java originally shipped without a set convention for managing library dependencies, largely because it predated many of the approaches we've developed to this problem over the last 25 years. While the JAR format gives us a way to bundle compiled JVM code, it doesn't include a mechanism for describing the relationship _between_ multiple JARs, and these semantics, including versioning, repository management, conflict resolution, etc, had to be filled in over time by community tooling.

After several iterations, including tools like [Ant](https://ant.apache.org/), not to mention home-grown systems involving FTP-ing or even emailing JAR files around, [Apache Maven](https://maven.apache.org/) eventually emerged as a de facto standard.

**Side Note**: While I'm sure Ant was great in its time, it eventually became so loathed in some circles that it inspired Clojure's build tool to be [named](https://github.com/technomancy/leiningen/blob/master/README.md#leiningen) after a [German Short Story](https://en.wikipedia.org/wiki/Leiningen_Versus_the_Ants) in which the protagonist battles a horde of ants in the Brazilian jungle. 🐜

### Maven's Library Model

While Maven remains a popular build tool in its own right, we're especially interested in its approach to dependency management, which established many conventions used throughout the JVM ecosystem. Even if you're not working with Maven itself, you're bound to encounter Maven-style libraries and patterns, so it's helpful to understand how it works.

In Maven's model, a library consists of:

1. A JAR containing compiled JVM class files. Maven-style library JARs generally contain only the library's own code, sometimes called a "thin" JAR.
2. A project identifier consisting of a Group ID, Artifact ID, and version. This serves as a unique coordinate for a package in a repository. Many JVM developers follow the ["Reverse Domain Name"](https://en.wikipedia.org/wiki/Reverse_domain_name_notation) convention to avoid collisions in package names.
3. A list of dependencies, expressed in the same Group/Artifact/Version format

Maven uses an XML-based Manifest format, called the [POM](https://maven.apache.org/guides/introduction/introduction-to-the-pom.html), or Project Object Model, to describe items 2 and 3. A project's POM gets written into a `pom.xml` file, often in the root of a project, and functions similarly to things like `package.json`, `Cargo.toml`, `Gemfile` + `gemspec`, or `mix.exs` that you may have seen in other build systems.

Here's an example `pom.xml` that defines a project with group `com.example`, artifact `my-app`, version `1.0`, and a single dependency, `ch.hsr.geohash` version 1.3.0:

```xml
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.example</groupId>
  <artifactId>my-app</artifactId>
  <version>1.0</version>
  <dependencies>
    <dependency>
      <groupId>ch.hsr</groupId>
      <artifactId>geohash</artifactId>
      <version>1.3.0</version>
    </dependency>
  </dependencies>
</project>
```

### Dependency Resolution + Classpath Management

The POM `<dependencies/>` list allows us to encode dependency graphs alongside JARs of compiled code. To share a Java library, you can publish your JAR plus a `pom.xml` to a public package repository like [Maven Central](https://maven.apache.org/). Then, other users can retrieve both of these files, use the attached `pom.xml` to identify additional transitive dependencies, and repeat the process until they've resolved the full tree.

Finally, once the build tool has resolved and downloaded all your dependencies, it can use the POM tree to automatically assemble a Classpath for compiling and running your project's code. One of the build tool's many responsibilities is flattening your dependency _tree_, via deduplication and version conflict resolution, into a _list_, where each individual package only appears once.

So while we looked before at specifying a Classpath manually, like `java -cp /path/to/lib1.jar:/path/to/lib2.jar com.example.MyClass`, in practice that process will almost always be managed by a build tool. When you run something like `mvn test` or `mvn compile`, the Classpath is still there. But Maven is handling it for you automatically, based on the information in your `pom.xml`.

Most build tools use some sort of local cache directory to save copies of remote dependencies (for Maven it's `~/.m2`), so if you examine your classpath locally, you may see it contains entries from that directory. Here's an example from the geohash-java project we saw before:

```
$ mvn dependency:build-classpath
# ...
[INFO] Dependencies classpath:
/Users/worace/.m2/repository/junit/junit/4.13.1/junit-4.13.1.jar:/Users/worace/.m2/repository/org/hamcrest/hamcrest-core/1.3/hamcrest-core-1.3.jar
```

### Maven and the Broader Ecosystem

Over the years a number of other build tools have been developed for the JVM: [Leiningen (Clojure)](https://leiningen.org/), [sbt (scala)](https://www.scala-sbt.org/), [Gradle (groovy, kotlin, etc)](https://gradle.org/), not to mention the "monorepo" tools like [Pants](https://www.pantsbuild.org/) and [Bazel](https://bazel.build/). But they all follow the same basic model: use a project spec to recursively retrieve library JAR files + dependency manifests, then generate a Classpath to use these libraries for compiling and running local source code.

And while these tools all have their own semantics, special features, and configuration files (`build.sbt`, `project.clj`, `build.gradle`, etc), they still support Maven's `pom.xml` as a standard interoperable dependency manifest format. Sometimes when we speak of "Maven libraries", we don't mean "projects literally managed by the Maven build tool", but rather, libraries that are built and distributed in keeping with the model Maven established.

## From Local Development to Production Distribution

So to recap:

* Compilers (`javac`, `scalac`, etc) turn language source code into bytecode (`.class` files) which the JVM can run
* JAR files bundle compiled `.class` files into manageable packages
* Project manifests like a `pom.xml` attach library versioning + dependency semantics to bundled JAR packages
* Build tools use this dependency info to retrieve required packages for your project and programmatically assemble a Classpath for compiling, testing, and running your code

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
