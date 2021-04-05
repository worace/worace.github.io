---
title: "Welcome to JAR Hell, Part 1"
subtitle: "A neophyte's guide to compilation, classpaths, and library management on the JVM"
layout: post
---

The JVM is a big tent. Maybe you're a seasoned veteran who's lived through everything from Applets to J2EE. Or maybe you're a weirdo who came in through Clojure, only to find that love for parentheses and immutable data structures was a slippery slope into Classpath troubleshooting (🙋).

This article is targeted at the latter group, and aims to provide a crash course in JVM app packaging for newcomers to the platform. We'll cover compilation basics, the Classpath, JARs, `pom.xml`, and the Maven dependency model. This is less about accomplishing specific build tasks and more about developing a mental model for how code gets packaged and distributed on the JVM.

This is Part 1 in a series, so stay tuned for Part 2, which will cover deployment strategies for JVM applications, and Part 3, which will look at the many ways your Classpath can get screwy in larger projects.

## Java and the JVM Class Model

As you may recall from "Java 101", Java code runs on the **J**ava **V**irtual **M**achine. These days, the JVM has evolved into a powerful [polyglot runtime](http://openjdk.java.net/projects/mlvm/summit2019/) that hosts a variety of non-Java languages. But it was originally created expressly for the purpose of running Java, and the 2 share a lot of common characteristics.

On the JVM, as in Java, _everything_ is a class, and the fundamental unit of code for the JVM is a `.class` file. The JVM can't run `.java` (or any other language) source files directly -- they must first be turned into `.class` files by a compiler.

A Classfile contains a binary representation of a class, following a structure defined by the [JVM Spec](https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-4.html). It includes slots for Class-y things like constructors, constants, fields, and methods. Most importantly, it contains our actual code, represented as [JVM Bytecode](https://en.wikipedia.org/wiki/Java_bytecode), which describes our program using the JVM's internal [instruction set](https://docs.oracle.com/javase/specs/jvms/se7/html/jvms-6.html), analogous to the machine-level instruction set hardwired into your [x86](https://en.wikipedia.org/wiki/X86_instruction_listings) or [ARM](https://en.wikipedia.org/wiki/ARM_architecture#Instruction_set) CPU. The definition of a "Class" can get surprisingly elastic on the JVM, but all code we run ultimately gets funneled through this format.

Java Class? Turned into a `.class`. Scala [Anonymous Function](https://www.toptal.com/scala/scala-bytecode-and-the-jvm)? Given a funny name and turned into a `.class`.
Clojure REPL expressions? Processed by the Clojure compiler and turned into a `.class`, albeit [at runtime, and probably without even writing it to disk](http://blog.kdgregory.com/2016/05/how-and-when-clojure-compiles-your-code.html).

Of course, this is just scratching the surface of a complex topic full of nuances. For one thing the conventions and state of the art around these things continue to evolve (newer versions of Scala actually _don't_ generate [standalone classes for anonymous functions](https://www.scala-lang.org/news/2.12.0/#java-8-style-bytecode-for-lambdas) because they use Java 8's [invokedynamic](https://www.infoq.com/articles/Invokedynamic-Javas-secret-weapon/) instead). And for another there are always exceptions (as the Clojure example demonstrates, you can in fact generate Bytecode at runtime rather than including it in a pre-compiled `.class` file, and this is especially common in dynamic languages like Clojure or [JRuby](https://realjenius.com/2009/10/06/distilling-jruby-the-jit-compiler/)). So we often use the term "Classfile" to describe the JVM's class model and binary format, even though it doesn't always require a physical `.class` file

But, _in general_, especially if you're working in a statically compiled language like Java or Scala, most things will get turned into a `.class` file at compile time. As we'll see, managing the generation, organization, and interaction of Classfiles is one of the fundamental tasks for JVM build tools and deployment workflows, so keeping them in mind is a useful model to understand how these processes work.

## Making Classes

In practice, we usually deal with `.class` compilation through build tools, but the simplest way to produce one is by invoking `javac` (or another JVM lang compiler) directly:

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

`javac` compiles our `Hello.java` source into a corresponding `Hello.class`. The [javap](https://docs.oracle.com/javase/7/docs/technotes/tools/windows/javap.html) tool can give you more insight into the contents of a `.class` file if you are interested in poking around further. But in short when we run a java command like `java Hello`, the `Hello` we're specifying is actually the name of a Class, and the JVM will execute the code it contains (by convention it looks for a [`main` method](http://tutorials.jenkov.com/java/main-method.html)).

## Classloading and the Classpath

We gave the `java` executable 1 argument, the name of our class, `Hello`, and it was able to run our program. How does this work?

Just as your shell has a `$PATH` variable which tells it where to look for executables, the JVM uses a setting called the ["Classpath"](https://docs.oracle.com/javase/tutorial/essential/environment/paths.html) to determine where to find `.class` files corresponding to new classes. The Classpath is a simple concept, but it's fundamental to how real-world JVM applications run (or, frequently, crash due to Classpath problems).

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

You can actually watch the JVM work through this process on the fly using the `-XX:+TraceClassLoading` debug flag. Running it on even a simple program will include a lot of noise from various system classes being loaded, but if you filter the results to our package you'll see it loading the 2 classes:

```
$ java -XX:+TraceClassLoading example.Pizza | rg example
[Loaded example.Pizza from file:/home/worace/scratch/jar-hell/]
[Loaded example.Calzone from file:/home/worace/scratch/jar-hell/]
```

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

You can also use the [`jar` executable](https://docs.oracle.com/javase/tutorial/deployment/jar/view.html) to see similar output without actually unzipping the file: `jar tf blah.jar` for example will list out all of the contained files.

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

**Amusing side note**: While I'm sure Ant was great in its time, it eventually became so loathed in some circles that it inspired Clojure's build tool to be [named](https://github.com/technomancy/leiningen/blob/master/README.md#leiningen) after a [German Short Story](https://en.wikipedia.org/wiki/Leiningen_Versus_the_Ants) in which the protagonist battles a horde of ants in the Brazilian jungle. 🐜

### Maven's Library Model

Maven is a powerful build tool which remains popular in its own right, but we're mostly interested in its approach to library and dependency management. Maven's conventions here have become widely accepted throughout the JVM ecosystem. Even if you're not working with Maven itself, you're bound to encounter Maven-style libraries and patterns, and it's helpful to understand how they work.

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

The POM `<dependencies/>` list allows us to encode dependency graphs alongside JARs of compiled code. To share a Java library, you can publish your JAR plus a POM to a public package repository like [Maven Central](https://repo.maven.apache.org/maven2/). (Aside: package repositories often rename this file to `<group>-<artifact>-<version.pom` instead of `pom.xml`, which is helpful because you don't end up with 100 identically named `pom.xml` files, so you can e.g. package them into a JAR as resource files). Then, other users can retrieve both of these files, use the attached `.pom` to identify additional transitive dependencies, and repeat the process until they've resolved the full tree.

Finally, once the build tool has resolved and downloaded all your dependencies, it can use the POM tree to automatically assemble a Classpath for compiling and running your project's code. **One of the build tool's many responsibilities is flattening your dependency _tree_, via deduplication and version conflict resolution, into a _list_, where each individual package only appears once**.

There are certainly a lot of pitfalls along this path (e.g. what happens if you depend on 2 libraries A and B which both depend on different versions of library C), which we'll look at more in Part 3. But optimistically, on the happy path, this process allows Maven (or another build tool) to programmatically turn a list of libraries contained in a dependency list into a usable Classpath.

So while we looked before at specifying a Classpath manually, like `java -cp /path/to/lib1.jar:/path/to/lib2.jar com.example.MyClass`, in practice that process will almost always be managed by a build tool. When you run something like `mvn test` or `mvn compile`, the Classpath is still there. But Maven is handling it for you, automatically, based on the information in your `pom.xml`.

You can see this at work by examining your project's Classpath directly. Here's an example from the geohash-java project we saw before:

```
$ mvn dependency:build-classpath
# ...
[INFO] Dependencies classpath:
/Users/worace/.m2/repository/junit/junit/4.13.1/junit-4.13.1.jar:/Users/worace/.m2/repository/org/hamcrest/hamcrest-core/1.3/hamcrest-core-1.3.jar
```

Most build tools use some sort of local cache directory to save copies of remote dependencies, which for Maven is `~/.m2`. So the packages we see here in directories like `/Users/<ME>/.m2/repository/...` are libraries that it has fetched from a remote source.

### Maven and the Broader Ecosystem

Over the years a number of other build tools have been developed for the JVM: [Leiningen (Clojure)](https://leiningen.org/), [sbt (scala)](https://www.scala-sbt.org/), [Gradle (groovy, kotlin, etc)](https://gradle.org/), not to mention the "monorepo" tools like [Pants](https://www.pantsbuild.org/) and [Bazel](https://bazel.build/). But they all follow the same basic model: use a project spec to recursively retrieve library JAR files + dependency manifests, then generate a Classpath to use these libraries for compiling and running local source code.

And while these tools all have their own semantics, special features, and configuration files (`build.sbt`, `project.clj`, `build.gradle`, etc), they generally still support Maven's `pom.xml` as a standard interoperable dependency manifest format. So often when we speak of "Maven libraries", we don't necessarily mean "projects directly managed by the Maven build tool", but simply libraries built and distributed in keeping with the conventions Maven established.

## Summary and Next Steps

So to recap:

* Compilers (`javac`, `scalac`, etc) turn language source code into bytecode (`.class` files) which the JVM can run
* JAR files bundle compiled `.class` files into manageable packages
* Project manifests like a `pom.xml` attach library versioning + dependency semantics to bundled JAR packages
* Build tools use this dependency info to retrieve required packages for your project and programmatically assemble a Classpath for compiling, testing, and running your code

What's next? Well, this system gives us a great workflow for local development, but it's very reliant on the build tool, which we'd ideally omit in production.

In the spirit of Java's infamous "write once run anywhere" promise, we'd love to bundle our application so that in production all it requires is a suitable Java runtime -- no Maven/sbt/gradle, and no repeating all of these steps around dependency resolution and Classpath generation. In Part 2, we'll look at some of the popular techniques for achieving this.
