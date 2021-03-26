---
title: "You're in the JARmy now: An eager neophyte's guide to JVM Packaging"
layout: post
---

"Write once, run anywhere," they said. "It'll be fun," they said. Well I once wrote some code and now I'm still waiting for 4.2GB of `.class` files to upload to the servers of an online bookstore so I can run it. I wish I could explain that to 1995 James Golick.

This is Part 1 of a 2-part series about Application Packaging and Dependency Management on the JVM. This section covers some of the basics of the JVM's compilation and packaging model. Part 2 investigates some of the problems that arise especially when managing dependencies for larger projects.

If you're a newcomer to the JVM or if you just have the particular type of brain worms that motivate you to read 5000 words about JARs, Classpaths, POMs, this may be of interest. In either case I am sorry for you.

## Summary / TL;DR
## Java Class Compilation Model

As you may have learned in your first "Hello World" intro to Java, the JVM consumes our code not as raw `.java` sources but as compiled `.class` files, which contain bytecode instructions the JVM understands.

We often deal with `.class` compilation via build tools (more on that soon), but the simplest way to produce them is via `javac` directly:

```java
// Hello.java
public class Hello {
    public static void main(String[] args) {
        System.out.println("Hello");
    }
}
```

```
$ javac Hello.java
$ ls
Hello.class     Hello.java
$ java Hello
Hello
```

`javac` compiles our `Hello.java` source into a corresponding `Hello.class`. When running a command like `java Hello`, the `Hello` is actually the name of a Class, and the JVM has to go and fetch it in order to execute the code it contains.

## Classloading and the Classpath

Just as your shell uses the `PATH` variable to know where to look for executables, the JVM uses a ["Classpath"](https://docs.oracle.com/javase/tutorial/essential/environment/paths.html) to determine where to search for `.class` files corresponding to a requested class name.

By default the Classpath is simply `.`, the current directory. So our previous example works because the `Hello.class` definition matching the class named `Hello` (`.class` files are named for the Class they contain) is sitting in the current directory, and the JVM is able to find it.

### Package and Directory Conventions

In practice, Java code is usually organized into packages (that's the `package com.mycorp.foo` you see at the top of all your company's Java files), and there's a [convention](https://docs.oracle.com/javase/tutorial/java/package/managingfiles.html) of expecting `.class` files on the Classpath to be organized in a directory structure that matches their package hierarchy.

So a more realistic example of a simple source / class tree might be:

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

This loads 2 of our classes: `example.Pizza`, which we triggered explicitly, and `example.Calzone`, which `example.Pizza` imports. In both cases, the classloader is able to find these by traversing the classpath (`.`, the default) to find the corresponding class files (`Pizza.class` and `Calzone.class`, matching their class names) under the directory (`./example/`) which corresponds to their package name.

## Packaging Classes into JAR Files

So using manual `javac` commands and some careful directory organization, we can produce a Classpath which gives the Classloader what it wants:

* One (or more) searchable base directories containing...
* Class files organized into subdirectories according to their package hierarchy

If needed, we could even wire up a crude deployment system from this by just `scp`-ing our whole directory to a server, `ssh`-ing into it, and running `java Foo` -- and people have certainly done this over the years.

But, carting around `.class` trees manually gets tedious, so they created a specification for packaging them into more organized bundles, called [JAR files](https://docs.oracle.com/javase/8/docs/technotes/guides/jar/jarGuide.html).

A JAR is basically a Zip archive (you can literally unpack them with `unzip`) containing some metadata files and a tree of class files. This is exactly the "scp our `.class` directory to a server" model we just mentioned, but wrapped in a trenchcoat to make it more presentable.

Like everything else in the JVM ecosystem, JAR files have acrued a lot of niche features over the years (special support for Applets, Service loader configuration, content signing, indexing schemes to speed up class loading, etc), but for most of us they're just the standard way to package and distribute (compiled) JVM code.

You can see how they work for yourself by pulling one from a public package archive and unpacking it:

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

Everything under `META-INF/` is metadata describing the packaged code, while the tree of class files corresponds to the compiled Java sources which you can see on [github](https://github.com/kungfoo/geohash-java).

JAR files are ubiquitous. Most JVM tools understand them, and **can use them directly as part of the classpath**:

```bash
# Launch the scala repl with this JAR on the classpath
$ scala -classpath geohash-1.3.0.jar
scala> import ch.hsr.geohash.GeoHash
import ch.hsr.geohash.GeoHash
```

So while your classpath can be composed of raw `.class` files, like the examples we saw earlier, for 3rd party code it's more common to use JARs. As with your shell's `$PATH` variable, you can include multiple classpath entries by separating them with `:`. So if you had several library JARs to use you might invoke a command like `java -cp /path/to/lib1.jar:/path/to/lib2.jar:/path/to/lib3.jar com.example.MyClass`.

So the classpath mechanism also lets us incorporate 3rd party library code into our JVM programs, which is great. But managing JAR packages manually is quite tedious, so in practice we'd use a build tool for this.

## Maven and the POM: From `.class` files in a trenchcoat to meaningful library semantics

JAR files provide a standard mechanism for bundling compiled JVM code, but they're fairly agnostic about the intent or provenance of that code.

In particular the JAR format itself does not include any provisions for describing the relationship between multiple packages, in the way we would expect from a modern software library and dependency management system.

While many languages nowadays launch with a clearly sanctioned build tool from day 1 (e.g. [Mix](https://hexdocs.pm/mix/Mix.html) for Elixir or [Cargo](https://doc.rust-lang.org/cargo/) for Rust), Java predated these conventions, and it took time for the ecosystem to coalesce around a standard. In the very early days, people simply managed library distribution by hand, via shell scripts, File servers, or even just emailing JAR files around.

Then there was a generation of "Build-a-Build" build tools, most famously [Ant](https://ant.apache.org/), which provided Make-like utilities for scripting common compilation and JAR management tasks, but was fairly low-level and encouraged a lot of customization.

Finally [Maven](https://maven.apache.org/) entered the scene, and brought a more modern flavor of dependency management and build tooling to Java. While Maven is still very popular in its own right, it's especially significant for establishing many of the dependency management conventions still in use throughout the JVM ecosystem today.

In Maven's model, a library consists of:

1. A JAR containing compiled JVM class files. Maven-style library JARs generally contain only the library's own code, sometimes called a "thin" JAR.
2. A project identifier consisting of a Group ID, Artifact ID, and version. This serves as a unique coordinate for a package in a repository. Many JVM developers follow the ["Reverse Domain Name"](https://en.wikipedia.org/wiki/Reverse_domain_name_notation) convention to avoid collisions in package names.
3. A list of dependencies, expressed in the same Group/Artifact/Version format

Maven uses an XML-based Manifest format, called the [POM](https://maven.apache.org/guides/introduction/introduction-to-the-pom.html), or Project Object Model, to describe items 2 and 3. A project's POM gets written into a `pom.xml` file, often in the root of a project, and functions similarly to `package.json` in NPM or `Cargo.toml` in Cargo.

For example this `pom.xml` defines a project with group `com.example`, artifact `my-app`, version `1.0`, and a single dependency, `ch.hsr.geohash` version 1.3.0:

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

Crucially, this structure adds the ability to encode dependency graphs alongside JARs of compiled code. To share a Maven library, you can publish your JAR plus a `pom.xml` to a public package repository like [Maven Central](https://maven.apache.org/). Then, other users will be able to retrieve both of these, use the attached `pom.xml` to identify additional transitive dependencies, and repeat the process until they've resolved the full tree.

Finally, once the build tool has resolved and downloaded all of these dependencies, it can use the POM tree to automatically assemble a Classpath for compiling and running your project's code. So while we looked before at doing this manually like `java -cp /path/to/lib1.jar:/path/to/lib2.jar com.example.MyClass`, in practice that process will usually be managed for you by a build tool such as Maven.

### Maven and the Broader Ecosystem

Over the years a number of other build tools have been developed for the JVM: [Leiningen (Clojure)](https://leiningen.org/), [sbt (scala)](https://www.scala-sbt.org/), [Gradle (groovy, kotlin, etc)](https://gradle.org/), not to mention the "monorepo" tools like [Pants](https://www.pantsbuild.org/) and [Bazel](https://bazel.build/). But they all follow the same basic model: use a project spec to recursively retrieve library JAR files + manifests, then generate a Classpath to use these libraries for compiling and running local source files.

And in practice, many of these other tools continue to use Maven's own `pom.xml` as a standard interchange format that they can all understand. So working in Clojure with Leiningen you'll use a `project.clj` file to define your own dependencies, but under the hood it's likely to consume and produce `pom.xml` files to interact with other projects.

## Build Tools: Ant, Maven, et al.

* Ant: Make-like build tool engine
* Maven: convention-based workflows
  * `pom.xml`
* compile code to class files
* bundle class files into JARs

### FAQ

* What are all these `$` in my `.class` names


### Resources

https://www.javapubhouse.com/2015/01/episode-47-stop-maven-time.html
https://manifest.fm/6

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

# Part 2: Classpath Hell and Managing Dependencies in Large Projects

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


It's worth noting that while the JVM's class and object model resonates closely with that of the Java language, they're not fundamentally linked. The wide range of non-Java JVM languages show that other compilers can target this format just fine, although the results may require `.class` encodings of things we wouldn't think of as very class-like.


The actual loading of compiled `.class` files into memory is accomplished by another component, called a [Classloader](https://www.baeldung.com/java-classloaders) which is mostly beyond the scope of this discussion, but provides yet another layer of subtlety in the whole process.


All of this can get quite complicated, so it's generally managed by...
