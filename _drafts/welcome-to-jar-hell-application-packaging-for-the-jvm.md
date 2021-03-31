---
title: "You're in the JARmy now"
subtitle: "An eager neophyte's guide to JVM packaging (Part 1 of 2)"
layout: post
---

The JVM has become a big tent in recent years.

There are definitely still veterans around who have lived through Applets and J2EE and all the rest, but there are also a lot of newcomers, who stumbled into the JVM unwittingly because of Clojure, or because of Spark, or Android, or whatever.

For those of us who didn't come in through the traditional Java developer path, there are a lot of JVM nuances like GC tuning, package mangement, etc that you have to absorb over time.

This post offers a crash course in JVM app packaging aimed at newcomers to the platform. We'll cover compilation basics, JARs, `pom.xml`, and deployment strategies. This is less about accomplishing build tasks with a specific tool like Maven and more about developing a mental model for how code gets packaged and distributed on the JVM.

Stay tuned as well for Part 2, which will cover more advanced topics such as the many ways your Classpath can get screwy when deploying large projects.

## Java and the JVM Class Compilation Model

As you may know, Java code runs on the **J**ava **V**irtual **M**achine. The JVM doesn't consume raw `.java` sources but rather compiled `.class` files, which contain bytecode instructions in the JVM instruction set. You can read more about the [JVM Instruction Set](https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-6.html) and the [ClassFile](https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-4.html) specification elsewhere, but in short they provide a binary representation of a Class including its fields, methods, etc.

The JVM Class model aligns closely with that of the Java language, but they're not fundamentally linked. Over the years many [alt-JVM languages](http://openjdk.java.net/projects/mlvm/summit2019/) have exploited this by compiling their own code into JVM bytecode and thus getting access to the JVM's excellent runtime for free. When the Scala compiler turns an [anonymous lambda expression into JVM bytecode](https://www.toptal.com/scala/scala-bytecode-and-the-jvm), it may do things that we would not think of as very "class-like", but it's still following the same rules and using the same format.

## Making `.class` files

We often deal with `.class` compilation via build tools, which we'll get to in a moment, but the simplest way to produce them is via `javac` (or another JVM lang compiler) directly:

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

Just as your shell uses a `PATH` variable to know where to look for executables, the JVM uses a similar concept, called the ["Classpath"](https://docs.oracle.com/javase/tutorial/essential/environment/paths.html), to determine where to search for `.class` files corresponding to a requested class name. The Classpath is a simple concept, but it's fundamental to how real-world JVM applications run (or, frequently, crash due to Classpath problems).

By default the Classpath is simply `.`, the current directory. So our previous example works because the `Hello.class` definition matching the class named `Hello` (`.class` files are named for the Class they contain) is sitting in the current directory, and the JVM is able to find it.

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

This loads 2 of our classes: `example.Pizza`, which we triggered explicitly, and `example.Calzone`, which `example.Pizza` imports. In both cases, the JVM is able to find these by traversing the classpath (`.`, the default) to find the corresponding class files (`Pizza.class` and `Calzone.class`, matching their class names) under the directory (`./example/`) which corresponds to their package name.

## Packaging Classes into JAR Files

So using manual `javac` commands and some careful directory organization, we can produce a Classpath which gives the runtime what it wants:

* One (or more) searchable base directories containing...
* Class files organized into subdirectories according to their package hierarchy

If needed, we could even wire up a crude deployment system from this by just `scp`-ing our whole directory to a server, `ssh`-ing into it, and running `java Foo`. And people certainly _have_ deployed JVM code like this over the years.

But, carting around `.class` trees manually gets tedious, so they created a specification for packaging them into more organized bundles, called [JAR files](https://docs.oracle.com/javase/8/docs/technotes/guides/jar/jarGuide.html).

A JAR is basically a Zip archive (you can literally unpack them with `unzip`) of a tree of class files along with a few bits of metadata. You can see how they work yourself by pulling one from a public package archive and unpacking it:

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

Everything under `META-INF/` is metadata describing the packaged code, while the tree of class files corresponds to the compiled representations of the Java sources you can see [here on github](https://github.com/kungfoo/geohash-java). If you examine the code in that repo, you'll see the package names and source directory structure match the `.class` tree in this JAR.

Many JVM tools understand JARs, meaning you **can use them directly as part of your classpath**:

```bash
# Launch the scala repl with this JAR on the classpath
# and import a class it contains
$ scala -classpath geohash-1.3.0.jar
scala> import ch.hsr.geohash.GeoHash
import ch.hsr.geohash.GeoHash
```

As with your shell's `$PATH` variable, you can include multiple Classpath entries by separating them with `:`, for example: `java -cp /path/to/lib1.jar:/path/to/lib2.jar:/path/to/lib3.jar com.example.MyClass`.

But, managing lists of JARs for a Classpath by hand gets tedious, so in practice we'll generally use a build tool...

## Maven and the POM: From ClassFiles in a trenchcoat to dependency semantics

While the JAR format provides a mechanism for bundling compiled JVM code, it's fairly agnostic about the intent or provenance of that code. In particular, there's not a built-in provision for describing the relationship _between_ multiple JARs, in the way we would expect from a modern software library and dependency management system.

Java predated many of the contemporary conventions around dependency management, so while it's common for newer languages to ship with these tools from day 1, it took time for the Java community to coalesce around a standard. After several iterations, including earlier tools like [Ant](https://ant.apache.org/), not to mention many home-rolled systems involving FTP-ing or even emailing JAR files around, [Maven](https://maven.apache.org/) eventually emerged as a de facto standard.

**Side Note**: While I'm sure Ant was great in its time, it eventually became so loathed in some circles that it inspired Clojure's build tool to be [named](https://github.com/technomancy/leiningen/blob/master/README.md#leiningen) after a [German Short Story](https://en.wikipedia.org/wiki/Leiningen_Versus_the_Ants) in which the protagonist battles a horde of ants in the Brazilian jungle.

### Maven's Library Model

While Maven remains a popular build tool in its own right, we're particularly interested in its dependency management conventions, which are still in use throughout the JVM ecosystem today.

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

Finally, once the build tool has resolved and downloaded all your dependencies, it can use the POM tree to automatically assemble a Classpath for compiling and running your project's code.

So while we looked before at doing this manually like `java -cp /path/to/lib1.jar:/path/to/lib2.jar com.example.MyClass`, in practice that process will usually be managed by a build tool. When you run something like `mvn test` or `mvn compile`, the Classpath is still there. But it's being handled for you automatically, based on the information in your `pom.xml`.

Most build tools use some sort of local cache directory (for Maven it's `~/.m2`) to save copies of remote dependencies. So if you examine your classpath locally, you may see it contains entries from that directory. Here's an example from the geohash-java project we saw before:

```
$ mvn dependency:build-classpath
# ...
[INFO] Dependencies classpath:
/Users/worace/.m2/repository/junit/junit/4.13.1/junit-4.13.1.jar:/Users/worace/.m2/repository/org/hamcrest/hamcrest-core/1.3/hamcrest-core-1.3.jar
```

### Maven and the Broader Ecosystem

Over the years a number of other build tools have been developed for the JVM: [Leiningen (Clojure)](https://leiningen.org/), [sbt (scala)](https://www.scala-sbt.org/), [Gradle (groovy, kotlin, etc)](https://gradle.org/), not to mention the "monorepo" tools like [Pants](https://www.pantsbuild.org/) and [Bazel](https://bazel.build/). But they all follow the same basic model: use a project spec to recursively retrieve library JAR files + dependency manifests, then generate a Classpath to use these libraries for compiling and running local source code.

And while these tools all have their own configuration format (`build.sbt`, `project.clj`, `build.gradle`, etc), they still support Maven's `pom.xml` as a standard interoperable dependency manifest format. So sometimes when we speak of Maven libraries, we don't mean projects literally managed by the Maven build tool, but rather libraries that are built and distributed in keeping with the model that Maven established.

## From Local Development to Production Distribution

So to recap:

* Compilers (`javac`, `scalac`, etc) turn language source code into bytecode (`.class` files) which the JVM can run
* JAR files bundle compiled `.class` files into a manageable package
* Project manifests (e.g. a `pom.xml`) attach library versioning + dependency semantics to bundled JAR packages
* Build tools use this dependency info to retrieve required packages for your project and programmatically assemble a Classpath for compiling, testing, and running your code

We've seen how this works locally, but what about deployment?

Luckily, the JVM makes this fairly easy -- as long as you don't get too crazy with native dependencies (e.g [JNI](https://en.wikipedia.org/wiki/Java_Native_Interface)), or shelling out to system commands, you should be able to run your app on any server with the proper [Java Runtime Environment](https://www.oracle.com/java/technologies/javase-jre8-downloads.html) version.

All you need to do is get this pile of `.class` files we've been accumulating into the right place, and there are a couple common ways to do that.

### Uber/Fat/Assembly JARs

The example JARs we've seen so far only contain the compiled `.class` for their own direct source code. Even if your project requires other dependencies to run, you would not include those dependencies' `.class` files in your JAR, because you expect anyone using your code to use a build tool (Maven, sbt, Leiningen, etc) to also retrieve the files for your dependencies and stitch the whole thing together into a final Classpath.

This type of JAR is sometimes called a "library" or "skinny" JAR. It's the default packaging strategy in most JVM build tools, and it's almost always what you want if you're distributing your code for other developers to consume (for example publishing into a package repository).

At deployment time, however, you want to distribute your code as an _application_, where the final consumer is not other users' code, but some production server environment. In these cases, you can build what's called an "Uber" or "Assembly" JAR.

An uberjar flattens out your application's compiled code, resources, _plus all the JARs on its classpath and all of their resources_ into a single output JAR. To do this, your build tool assembles a Classpath like normal, compiles your code, then goes 1 by 1 through all the other JARs on the classpath, unpacks them, and repacks their contents into the final uberjar. It's basically a whole bunch of JARs packed into one.

The benefit of this is that the final product no longer has any dependencies. Its whole Classpath is just the one resulting JAR, and if things go well your whole deployment model can consist of uploading the uberjar to production and invoking `java -jar my-application.jar`. It's sort of the JVM equivalent of building a single executable binary out of a language like Go or Rust.

Most build tools either have this built in or provide a plugin for doing it: [Maven Assembly Plugin](http://maven.apache.org/plugins/maven-assembly-plugin/), [sbt-assembly](https://github.com/sbt/sbt-assembly), [Leiningen (built in)](https://github.com/technomancy/leiningen/blob/master/doc/TUTORIAL.md#uberjar). Consult the README for whichever of these you're using for more details on setting them up.

Uberjar deployments are especially common in the Hadoop/Spark ecosystem, but get used a lot for web services as well.

#### Uberjar Gotcha: Resource Deduplication

In addition to compiled `.class` files, JARs can also include other non-code files called "resources". These could be configuration files, static assets, etc., and can be accessed programmatically via Java [APIs](https://docs.oracle.com/javase/8/docs/technotes/guides/lang/resources.html).

The catch is that resource files in a JAR have to be unique, so when you squash all your deps into an uberjar, you'll have to resolve these conflicts. Different tools have different ways of configuring this, but it's common to specify a "Merge Strategy" for handling these conflicts. For example here's [sbt-assembly's docs on the subject](https://github.com/sbt/sbt-assembly#merge-strategy).

#### Other Uberjar Topics

Dpeending on your use case, there are bunch of variations you can add to this approach. Hopefully we'll look at some of these in Part 2, but in the meantime you can read more:

* [Shading, a way to relocate private copies of a Class to deal with conflicts](https://maven.apache.org/plugins/maven-shade-plugin/examples/class-relocation.html)
* [Uberjar variants](https://dzone.com/articles/the-skinny-on-fat-thin-hollow-and-uber)
* [WAR Files](https://docs.oracle.com/cd/E19199-01/816-6774-10/a_war.html) - WAR files are a JAR variant used for deploying certain types of Java web applications in the J2EE ecosystem. They're not exactly the same as an uberjar, but the topics are related. I'm neither very familiar with nor very interested in J2EE, so you'll have to read up on this elsewhere.

### Docker

Ironically one Java's initial selling points was the simplicity and reliability of its deployments -- as long as your server has the right version of Java, it can run any of your applications. The proliferation of Docker-based deployments diminishes this benefit somewhat, but nonetheless, the JVM runs just fine with Docker. In many cases, you can just grab the [OpenJDK](https://hub.docker.com/_/openjdk) image of the appropriate version and go.

Usually you'll be putting into your Docker image some variation of one of the previous models:

* Build an uberjar and put it in a JDK docker image
* Put your compiled code and all your dependencies into a docker image and include an entrypoint command that invokes them correctly (sbt's [native-packager](https://www.scala-sbt.org/sbt-native-packager/formats/docker.html) plugin does this)
* Use a dedicated Java-to-Container build plugin like [Google's Jib](https://github.com/GoogleContainerTools/jib)

## Summary

So, that's that. JVM packaging from making ClassFiles with `javac` to bundling full applications for deployment. There are a lot of details that I've had to omit here, so depending on your use case you'll probably need to read more elsewhere. But hopefully this has given you enough of an overview to understand how the pieces fit together, and make informed research elsewhere.

Stay tuned for **Part 2**, in which we will descend into Classpath Hell, and hopefully emerge singed, but enlightened.
