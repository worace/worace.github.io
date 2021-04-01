---
title: "You're in the JARmy now"
subtitle: "An eager neophyte's guide to JVM packaging (Part 1 of 2)"
layout: post
---

The JVM is a big tent. Maybe you're a seasoned veteran who's lived through it all from Applets to J2EE. Or maybe you're a weirdo like me who came in through Clojure, only to find that love for parentheses and immutable data structures is actually a slippery slope into GC tuning and Classpath troubleshooting.

This article is targeted at the latter group, and aims to provide a crash course in JVM app packaging for newcomers to the platform. We'll cover compilation basics, JARs, `pom.xml`, and deployment strategies. This is less about accomplishing tasks with a specific build tool and more about developing a mental model for how code gets packaged and distributed on the JVM.

Stay tuned as well for Part 2, which will cover more advanced topics such as the many ways your Classpath can get screwy when deploying large projects.

## Java and the JVM Class Model

As you may know, Java code runs on the **J**ava **V**irtual **M**achine. The JVM doesn't consume raw `.java` sources but rather compiled `.class` files, which contain bytecode instructions in the JVM instruction set. You can read more about the [JVM Instruction Set](https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-6.html) and the [ClassFile](https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-4.html) specification elsewhere, but in short they provide a binary representation of the code for a Class, including its fields, constructors, methods, etc.

The JVM Class model aligns closely with that of the Java language, but they're not fundamentally linked. Thanks to this separation, the many [alt-JVM languages](http://openjdk.java.net/projects/mlvm/summit2019/) are able to compile their own code into JVM bytecode, and get access to the JVM's excellent runtime for free.

When the Scala compiler turns an [anonymous lambda expression into JVM bytecode](https://www.toptal.com/scala/scala-bytecode-and-the-jvm), it may do things that we would not think of as very "class-like", but it's still following the same model, with the same rules and binary format.

## Making `.class` files

We often deal with `.class` compilation via build tools, which we'll get to in a moment, but the simplest way to produce them is by invoking `javac` (or another JVM lang compiler) directly:

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

`javac` compiles our `Hello.java` source into a corresponding `Hello.class`. When running a command like `java Hello`, `Hello` is actually the name of a Class, and the JVM has to go and fetch it in order to execute the code it contains.


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

A JAR is basically a Zip archive (you can literally unpack them with `unzip`) containing a tree of class files along with a few bits of metadata. You can see how they work yourself by pulling one from a public package archive and unpacking it:

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

Everything under `META-INF/` is metadata describing the packaged code, while the tree of class files corresponds to the compiled representations of the Java sources you can see [here on github](https://github.com/kungfoo/geohash-java). If you examine the code in that repo, you'll see the package names and source directory structure match the `.class` tree in this JAR, just like our `example.Calzone` and `./example/Calzone.class` tree matched before.

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

## Maven and the POM: From ClassFiles in a trenchcoat to dependency semantics

While the JAR format provides a mechanism for bundling compiled JVM code, it's fairly agnostic about the intent or provenance of that code. In particular, there's not a built-in provision for describing the relationship _between_ multiple JARs, in the way we expect from a modern dependency management system.

Java itself predated many of these conventions, so while it's common for newer languages to ship with such tools from day 1, it took time for the Java community to coalesce around a standard. After several iterations, including earlier tools like [Ant](https://ant.apache.org/), not to mention many home-grown systems involving FTP-ing or even emailing JAR files around, [Maven](https://maven.apache.org/) eventually emerged as a de facto standard.

**Side Note**: While I'm sure Ant was great in its time, it eventually became so loathed in some circles that it inspired Clojure's build tool to be [named](https://github.com/technomancy/leiningen/blob/master/README.md#leiningen) after a [German Short Story](https://en.wikipedia.org/wiki/Leiningen_Versus_the_Ants) in which the protagonist battles a horde of ants in the Brazilian jungle.

### Maven's Library Model

While Maven remains a popular build tool in its own right, we're particularly interested in its approach to dependency management, which established many of the conventions still used throughout the JVM ecosystem today. Even if you're not working with Maven itself, you're bound to encounter Maven-style libraries and patterns, so it's helpful to understand how it works.

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

The POM `<dependencies/>` list allows us to encode dependency graphs alongside JARs of compiled code. To share a Java library, you can publish your JAR plus a `pom.xml` to a public package repository like [Maven Central](https://maven.apache.org/). Then, other users will be able to retrieve both of these files, use the attached `pom.xml` to identify additional transitive dependencies, and repeat the process until they've resolved the full tree.

Finally, once the build tool has resolved and downloaded all your dependencies, it can use the POM tree to automatically assemble a Classpath for compiling and running your project's code. One of the build tool's many responsibilities is flattening your dependency _tree_, via deduplication and version conflict resolution, into a _list_, where each individual package only appears once.

So while we looked before at specifying a Classpath manually, like `java -cp /path/to/lib1.jar:/path/to/lib2.jar com.example.MyClass`, in practice that process will usually be managed by a build tool. When you run something like `mvn test` or `mvn compile`, the Classpath is still there. But it's being handled for you automatically, based on the information in your `pom.xml`.

Most build tools use some sort of local cache directory to save copies of remote dependencies (for Maven it's `~/.m2`), so if you examine your classpath locally, you may see it contains entries from that directory. Here's an example from the geohash-java project we saw before:

```
$ mvn dependency:build-classpath
# ...
[INFO] Dependencies classpath:
/Users/worace/.m2/repository/junit/junit/4.13.1/junit-4.13.1.jar:/Users/worace/.m2/repository/org/hamcrest/hamcrest-core/1.3/hamcrest-core-1.3.jar
```

### Maven and the Broader Ecosystem

Over the years a number of other build tools have been developed for the JVM: [Leiningen (Clojure)](https://leiningen.org/), [sbt (scala)](https://www.scala-sbt.org/), [Gradle (groovy, kotlin, etc)](https://gradle.org/), not to mention the "monorepo" tools like [Pants](https://www.pantsbuild.org/) and [Bazel](https://bazel.build/). But they all follow the same basic model: use a project spec to recursively retrieve library JAR files + dependency manifests, then generate a Classpath to use these libraries for compiling and running local source code.

And while these tools all have their own semantics, special features, and configuration file formats (`build.sbt`, `project.clj`, `build.gradle`, etc), they still support Maven's `pom.xml` as a standard interoperable dependency manifest. So sometimes when we speak of Maven libraries, we don't mean "projects literally managed by the Maven build tool", but rather libraries that are built and distributed in keeping with the model that Maven established.

## From Local Development to Production Distribution

So to recap:

* Compilers (`javac`, `scalac`, etc) turn language source code into bytecode (`.class` files) which the JVM can run
* JAR files bundle compiled `.class` files into a manageable package
* Project manifests like a `pom.xml` attach library versioning + dependency semantics to bundled JAR packages
* Build tools use this dependency info to retrieve required packages for your project and programmatically assemble a Classpath for compiling, testing, and running your code

We've seen how this works locally, but what about deployment?

Luckily, the JVM makes this fairly easy -- as long as you don't get too crazy with native dependencies (e.g [JNI](https://en.wikipedia.org/wiki/Java_Native_Interface)), or shelling out to system commands, you should be able to run your app on any server with the proper [Java Runtime Environment](https://www.oracle.com/java/technologies/javase-jre8-downloads.html) version.

All we need to do is get this pile of `.class` files we've accumulated into the right place, and there are a couple common ways to do that.

### Side Note: Libraries vs Applications

### Zip, Push, and Script

One common approach involves doing a straightforward upload of all the JARs your build tool has resolved for your Classpath, along with the one it has created for your actual code, onto your production environment. Then, in production, you would invoke the appropriate `java` command, along the lines of `java -cp <My application JAR>:<all my library JARs> com.mycorp.MyMainClass`. Often people will wrap this last bit in some kind of generated script that makes it easier to get the Classpath portion right.

There are a lot of different ways to achieve this, so it's really kind of a broad family of techniques and will vary depending on what specific build tool and type of application you're trying to run. Sbt's [native-packager](https://github.com/sbt/sbt-native-packager) plugin offers a bunch of distribution techniques, and some of them fall into this category. For example it can package all of your JARs into a Zip archive or tarball (yes, for those keeping score, we're now putting JARs, which are rebranded Zip archives, into other Zip archives), which includes the packages + a handy run script that will kick everything off. It can even build platform-specific archives, like a `deb` for installation with `dpkg` on Debian systems, or an `msi` image for Windows deployments. I'm less familiar with the offerings outside of sbt, but there are likely comparable tools out there for Maven, Gradle, etc.

If you're on AWS and EC2, Netflix has done a lot of work around automating deployments via [AMIs](https://github.com/Netflix/aminator), and has released some tooling (e.g. [Nebula](https://nebula-plugins.github.io/documentation/introduction_to_nebula.html))

There's also always the tried and true [Heroku approach](https://devcenter.heroku.com/articles/java-support#activation), which is to clone your source tree onto your prod server, run the build process _there_, then kick off your server process from the resulting artifacts. This approach works fine too, and allows them to help manage some of the conventions around how your build is run. The downside is that this requires extra dependencies in your prod environment (you need your build tools in addition to just the Java runtime), but it works fine in many cases. (Worth noting that Heroku also supports deploying Java apps via [pre-built JARs](https://devcenter.heroku.com/articles/deploying-java-applications-with-the-heroku-maven-plugin))

The point is there are a whole host of options here, depending on what platform or build tool you're working with. But they all share the same rough goal of 1) using a build tool to fetch deps, resolve a Classpath, and compile code, 2) pushing those artifacts to a prod server, and 3) passing it all off to the appropriate `java` command.

### Uber/Fat/Assembly JARs

The main annoyance about the previous approach is that it can require shuffling a lot of files around.

The JARs we've seen so far only contain the compiled `.class` files for their own direct source code. Even if your project requires other dependencies to run, those dependencies' `.class` files aren't included, because you expect to access them via a build tool which will stitch them into your Classpath.

This type of JAR is sometimes called a "skinny" JAR. It's the default packaging strategy in most JVM build tools, and it's what you want if you're distributing your code for other developers to consume (for example publishing a library into a package repository), or if you're going to be running the code along with all of the other JARs on the Classpath (like what happens with `mvn test`, etc). It's good from a library management perspective because it keeps things granular and composable, but it can be annoying at deployment time because you end up with dozens or even hundreds of JARs to cart around. What if you could just get it all onto _one_ JAR?

It turns out JARs _can_ be used (abused?) in this way, by creating what's called an "Uber", "Assembly", of "Fat" JAR. An uberjar flattens out your application's compiled code, resources, _plus all the JARs on its classpath and all of their resources_ into a single output JAR. To do this, your build tool fetches dependencies and compiles your code like normal, then goes 1 by 1 through all the other JARs on the Classpath, unpacks them, and repacks their contents into the final uberjar. It's basically a whole bunch of JARs squished into one.

The benefit of this is that the final product no longer has any dependencies. Its whole Classpath is just the one resulting JAR, and your whole deployment model can consist of uploading the uberjar to production and invoking `java -jar my-application.jar`. It's sort of the JVM equivalent of building a single executable binary out of a language like Go or Rust.

Most build tools either have this built in or provide a plugin for doing it: [Maven Assembly Plugin](http://maven.apache.org/plugins/maven-assembly-plugin/), [sbt-assembly](https://github.com/sbt/sbt-assembly), [Leiningen (built in)](https://github.com/technomancy/leiningen/blob/master/doc/TUTORIAL.md#uberjar). Consult the README for whichever of these you're using for more details on setting them up.

Uberjar deployments are especially common in the Hadoop/Spark ecosystem, but get used a lot for web services or other server applications as well.

#### Uberjar Gotcha: Resource Deduplication

In addition to compiled `.class` files, JARs can also include other non-code files called "resources". These could be configuration files, static assets, etc., and can be accessed programmatically via Java [APIs](https://docs.oracle.com/javase/8/docs/technotes/guides/lang/resources.html).

The catch is that resource files in a JAR have to be unique, so when you squash all your deps into an uberjar, you'll have to resolve these conflicts. Different tools have different ways of configuring this, but it's common to specify a "Merge Strategy" for handling these conflicts. For example here's [sbt-assembly's docs on the subject](https://github.com/sbt/sbt-assembly#merge-strategy).

#### Other Uberjar Topics

Uberjar configuration can get quite complex, so depending on your use case there are bunch of variations you can add to this approach. Hopefully we'll look at some of these in Part 2, but in the meantime you can read more:

* [Shading, a way to relocate private copies of a Class to deal with conflicts](https://maven.apache.org/plugins/maven-shade-plugin/examples/class-relocation.html)
* [Uberjar variants](https://dzone.com/articles/the-skinny-on-fat-thin-hollow-and-uber)

### WAR Files and J2EE

[WAR Files](https://docs.oracle.com/cd/E19199-01/816-6774-10/a_war.html) are a special type of JAR variant used for deploying certain types of Java web applications in the J2EE ecosystem. J2EE is a whole can of worms that I honestly don't know that much about, nor am I very interested in learning. But it does come up a lot so it's worth touching on here.

In short, these applications are designed to deploy not to generic VMs (like an Ubuntu 16 instance or w/e) but rather into specialized Java-based [Application Servers](https://en.wikipedia.org/wiki/List_of_application_servers#Java), like [Apache Tomcat](http://tomcat.apache.org/). Your company would run one or more of these Tomcat instances, which get treated as shared infrastructure, and individual applications would package their code (into WARs) and deploy into into _those_.

The application server handles process of orchestrating your application (no `java -jar MyApp.jar` here), as well as providing a bunch of [common J-* branded system services](https://en.wikipedia.org/wiki/Jakarta_EE#Web_profile). Because of all this, there are extra considerations around packaging and deployment to make sure the 2 systems (your application and the hosting Application Server) play nicely together, and that's where the WAR spec comes in.

[This article](https://javapipe.com/blog/tomcat-application-server/) gives a good overview of this whole system. [Here's another good one](https://octopus.com/blog/application-server-vs-uberjar) about WARs specifically.

As an aside, despite my skepticism and poorly masked disdain for all this, it is kind of amusing to read about. The idea of persistent, multitenant JVM app servers is interesting, and if you squint right, running WARs via Tomcat isn't so different from how everyone today is running "pods" of "containers" on abstracted machines via kubernetes. It just has a horrifying enterprise-y pocket protector kind of vibe around it.

And the decline of one is not unrelated to the rise of the other -- while there are plenty of J2EE deployments out there, much of the ecosystem has moved away from this model. People care more about portability between cloud environments and deployment standardization between languages (e.g. the [12 Factor Model](https://12factor.net/)), and in that environment highly customized, language-specific infrastructure is less appealing than a giant uberjar you can run anywhere with a Java runtime.

### Container Images

Ironically one of Java's initial selling points -- simplicity of deployment -- has been somewhat diminished by the proliferation of Docker.

Now that everyone's production environments are just a _???_, the benefit of just putting the JRE on all your servers and being able to run things doesn't matter as much.

Nonetheless, the JVM runs just fine with Docker, and in many cases, you can simply grab the appropriate [OpenJDK](https://hub.docker.com/_/openjdk) image version, stuff your JARs into it, and go.

Usually you'll be putting into your Docker image some variation of one of the previous models:

* Build an uberjar and put it in a JDK docker image
* Put your compiled code and all your dependencies into a docker image and include an entrypoint command that invokes them with the proper settings and Classpath (sbt's [native-packager](https://www.scala-sbt.org/sbt-native-packager/formats/docker.html) plugin does this)
* Use a dedicated Java-to-Container build plugin like [Google's Jib](https://github.com/GoogleContainerTools/jib)

### GraalVM Native Images

## Summary

So there's your crash course in JVM packaging. There are a ton of details surrounding this topic, so we've inevitably had to skip over a lot. But hopefully it provides enough of an overview to understand how the pieces fit together, and make informed further research elsewhere.

What's next? I'm sure you must be thinking, "Wow, with such a robust packaging system surely everything must work perfectly in production?" Ha! If only! Just whisper the words "ClassNotFoundException" to a Java developer and see how they react.

Unfortunately, it does not, in fact, all work perfectly in production. To learn more about this, stay tuned for **Part 2**, in which we will descend into Classpath Hell, and hopefully emerge singed, but enlightened.
