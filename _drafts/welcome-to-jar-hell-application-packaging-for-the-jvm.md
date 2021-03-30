---
title: "You're in the JARmy now"
subtitle: "An eager neophyte's guide to JVM packaging"
layout: post
---

The JVM has become quite a big tent in recent years. There are still some grizzled vetrans around, to be sure, who lived through applets and J2EE and all the rest, but there are also weirdos like me, who stumbled into the JVM unwittingly because of Clojure, or Scala or JRuby or whatever. I did not know at the time, but my nascent love of parentheses and immutable data structures was a slippery slope into grudging familiarity with the JVM as a platform. One of the many things I've absorbed through osmosis on this journey is an understanding of the JVM app packaging model. In recent years I've worked with JVM code in Clojure, Scala, Ruby (JRuby), Javascript (Nashorn - don't ask), and occasionally I even write some Java. While they all have their own quirks, one common theme is a shared reliance on the JVM packaging and library distribution model for reusing and deploying code.

This post attempts to distill some of this in a way that current and future JVM newcomers can digest. This is less of a tutorial for performing specific build actions with a tool like Maven, and more about developing a mental model for how code gets packaged and distributed for the JVM. I'll also try to cover a bit of the narrative history for how these approaches evolved which sometimes helps in understanding how things got to be the way they are.

This is Part 1 of a 2-part series. This section covers some of the basics of the JVM's compilation and packaging model, so if you're a veteran who's been writing Ant scripts since 2001, it may not be fo much use for you. In Part 2, we'll look at some more advanced topics and in particular discuss some of the problems that arise especially when managing dependencies for larger JVM projects.

If you're a newcomer to the JVM or if you just have the particular type of brain worms that motivate you to read 5000 words about JARs, Classpaths, POMs, this may be of interest. In either case I am sorry for you.

## Java and the JVM Class Compilation Model

As is oft repeated, Java code runs on the **J**ava **V**irtual **M**achine. The JVM does not consume code from raw `.java` sources but rather as compiled `.class` files, which contain bytecode instructions the JVM understands. You can read more about the [ClassFile](https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-4.html) specification elsewhere, but in short it contains a binary representation of a Class including its fields, methods, etc.

Unsurprisingly, the JVM Class model resonates closely with that of the Java language, for which it was created. But it's worth noting that they're not fundamentally linked. And over the years we've seen many alt-JVM languages exploit this fact by compiling their own code into this format and this getting access to the JVM's excellent runtime for free (There's even a whole [conference](http://openjdk.java.net/projects/mlvm/summit2019/) about it!). When the Scala compiler turns an [anonymous lambda expression into JVM bytecode](https://www.toptal.com/scala/scala-bytecode-and-the-jvm), it may do things that we would not think of as very "class-like", but it's still following the same rules and using the same format.

### Making `.class` files

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

`javac` compiles our `Hello.java` source into a corresponding `Hello.class`. When running a command like `java Hello`, the `Hello` is actually the name of a Class, and the JVM has to go and fetch it in order to execute the code it contains.

If you want to see a more thorough explanation of how this looks to the JVM, you can actually interrogate it with `javap`:

```
$ javap -p -v Hello.class
Classfile /Users/worace/Dropbox/scratch/jar-hell/Hello.class
  Last modified Mar 14, 2021; size 401 bytes
  MD5 checksum 82b2651206ac355844d233fbfdb42297
  Compiled from "Hello.java"
public class Hello
  minor version: 0
  major version: 52
  flags: ACC_PUBLIC, ACC_SUPER
Constant pool:
   #1 = Methodref          #6.#15         // java/lang/Object."<init>":()V
   #2 = Fieldref           #16.#17        // java/lang/System.out:Ljava/io/PrintStream;
   #3 = String             #18            // Hello
   // ...
{
  public Hello();
    descriptor: ()V
    flags: ACC_PUBLIC
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
SourceFile: "Hello.java"
```

Again, the meaning of all that is beyond the scope of this article, but if you're interested in JVM internals you can read up on it elsewhere.

## Classloading and the Classpath

So we can compile and run a trivial example with 1 class, but what about when there are more of them, and they want to interact?

Just as your shell uses a `PATH` variable to know where to look for executables, the JVM uses a similar concept of the ["Classpath"](https://docs.oracle.com/javase/tutorial/essential/environment/paths.html) to determine where to search for `.class` files corresponding to a requested class name. The Classpath is a simple concept, but it's very fundamental to how real-world JVM applications get run (or, frequently, crash due to Classpath problems).

By default the Classpath is simply `.`, the current directory. So our previous example works because the `Hello.class` definition matching the class named `Hello` (`.class` files are named for the Class they contain) is sitting in the current directory, and the JVM is able to find it.

### Package and Directory Conventions

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

The actual loading of `.class` file to in-memory Class representation is handled by another component, called a [ClassLoader](https://docs.oracle.com/javase/7/docs/api/java/lang/ClassLoader.html), which is also out of the scope of this discussion.

## Packaging Classes into JAR Files

So using manual `javac` commands and some careful directory organization, we can produce a Classpath which gives the ClassLoader what it wants:

* One (or more) searchable base directories containing...
* Class files organized into subdirectories according to their package hierarchy

If needed, we could even wire up a crude deployment system from this by just `scp`-ing our whole directory to a server, `ssh`-ing into it, and running `java Foo` -- and people certainly have deployed JVM code like this over the years.

But, carting around `.class` trees manually gets tedious, so they created a specification for packaging them into more organized bundles, called [JAR files](https://docs.oracle.com/javase/8/docs/technotes/guides/jar/jarGuide.html).

A JAR is basically a Zip archive (you can literally unpack them with `unzip`) containing some metadata files and a tree of class files. This is exactly the "scp our `.class` directory to a server" model we just mentioned, but wrapped in a trenchcoat to make it more presentable. JAR files have a bunch of other niche features (special Applet support, Service loader configuration, content signing, indexing schemes to speed up class loading, etc), but for most of us they're just the standard way to package and distribute (compiled) JVM code.

You can see how they work yourself by pulling one from a public package archive and unpacking it:

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

JARs can also include other files like static assets (e.g. images for a web app) or configuration files, which are called "resources". Most projects put these under a directory like `src/main/resources/blah.txt`, which will get bundled into the top level of the JAR like `/blah.txt.

Many JVM tools understand JARs directly, meaning you **can use them directly as part of your classpath**:

```bash
# Launch the scala repl with this JAR on the classpath
# and import a class it contains
$ scala -classpath geohash-1.3.0.jar
scala> import ch.hsr.geohash.GeoHash
import ch.hsr.geohash.GeoHash
```

So while your classpath can be composed of raw `.class` files, like the examples we saw earlier, for 3rd party code it's more common to use JARs. As with your shell's `$PATH` variable, you can include multiple classpath entries by separating them with `:`, for example: `java -cp /path/to/lib1.jar:/path/to/lib2.jar:/path/to/lib3.jar com.example.MyClass`.

So the default Classpath / Class Loading mechanics allow us to provide the JVM with our own locally compiled code as well as 3rd party library code, which is great. But, managing JAR packages manually gets tedious. In practice this will almost always be done with a build tool...

## Maven and the POM: From `.class` files in a trenchcoat to meaningful library semantics

While the JAR format does provide a standard mechanism for bundling compiled JVM code, it's fairly agnostic about the intent or provenance of that code. In particular, JARs themselves don't include any provisions for describing the relationship between multiple packages, in the way we would expect from a modern software library and dependency management system.

While many languages nowadays launch with a clearly sanctioned build tool from day 1 (e.g. [Mix](https://hexdocs.pm/mix/Mix.html) for Elixir or [Cargo](https://doc.rust-lang.org/cargo/) for Rust), Java predated these conventions, and it took time for the ecosystem to coalesce around a standard. In the very early days, people tended to manage library distribution by hand, via shell scripts, FTP servers, or even just emailing JAR files around.

Then there was a generation of "Build-a-Build" build tools, most famously [Ant](https://ant.apache.org/), which provided Make-like utilities for scripting common compilation and JAR management tasks, but were fairly low-level and encouraged a lot of customization.

Finally [Maven](https://maven.apache.org/) entered the scene, and brought a more modern flavor of dependency management and build tooling to Java.

### Maven's Library Model

While Maven is still very popular in its own right, it's especially significant for establishing many of the dependency management conventions still in use throughout the JVM ecosystem today.

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

Finally, once the build tool has resolved and downloaded all of these dependencies, it can use the POM tree to automatically assemble a Classpath for compiling and running your project's code. So while we looked before at doing this manually like `java -cp /path/to/lib1.jar:/path/to/lib2.jar com.example.MyClass`, in practice that process will usually be managed for you by a build tool such as Maven. When you run something like `mvn test` or `mvn compile`, the Classpath is still there. But it's being handled for you automatically by Maven, based on the information in your `pom.xml`.

### Maven and the Broader Ecosystem

Over the years a number of other build tools have been developed for the JVM: [Leiningen (Clojure)](https://leiningen.org/), [sbt (scala)](https://www.scala-sbt.org/), [Gradle (groovy, kotlin, etc)](https://gradle.org/), not to mention the "monorepo" tools like [Pants](https://www.pantsbuild.org/) and [Bazel](https://bazel.build/). But they all follow the same basic model: use a project spec to recursively retrieve library JAR files + manifests, then generate a Classpath to use these libraries for compiling and running local source files.

And in practice, many of these other tools even continue to use Maven's own `pom.xml` as a standard interchange format that they can all understand. So working in Clojure with Leiningen you'll use a `project.clj` file to describe your build and define your own dependencies, but under the hood it's likely to consume and produce `pom.xml` files to interact with other projects.

## From Local Development to Production Distribution

So to recap:

* Compilers (`javac`, `scalac`, etc) turn language source code into bytecode (`.class` files) which the JVM can run
* JAR files bundle compiled `.class` files for a given project or library into a manageable package
* Build tools, such as Maven, use project manifests (e.g. a `pom.xml`) to attach library versioning + dependency semantics to bundled JAR packages
* Build tools, again, use this dependency graph to retrieve all the required packages for your project and programmatically assemble them into a Classpath you can use for tasks like compiling, testing, or running your code

What about deployment? Now that I can build my project locally, I want to run it on a server somewhere. In some ways, this is a great strength of the JVM -- as long as you're not doing anything too crazy with native system dependencies (e.g [JNI](https://en.wikipedia.org/wiki/Java_Native_Interface)), or shelling out to system commands from your code, for the most part your server will "just" need a Java Runtime Environment in order to run your code.

All you need to do is get this pile of `.class` files we've been accumulating into the right place, and there are a couple common ways to do that.

### 'dist' packaging of an app and its dependencies

### Uber/Fat/Assembly JARs

#### Resource Deduplication

## Build Tools: Ant, Maven, et al.

* Ant: Make-like build tool engine
* Maven: convention-based workflows
  * `pom.xml`
* compile code to class files
* bundle class files into JARs

### FAQ / TODO

* What are all these `$` in my `.class` names
* Why don't JARs handle library manifests directly
* Build tool 101
* Do we really need all this stuff?
* Why does my java project have 30 levels of nested directories? Project organization conventions `src/main/scala/...` + resources


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




The actual loading of compiled `.class` files into memory is accomplished by another component, called a [Classloader](https://www.baeldung.com/java-classloaders) which is mostly beyond the scope of this discussion, but provides yet another layer of subtlety in the whole process.


All of this can get quite complicated, so it's generally managed by...


"Write once, run anywhere," they said. "It'll be fun," they said. Well I once wrote some code and now I'm still waiting for 4.2GB of `.class` files to upload to the servers of an online bookstore so I can run it. I wish I could explain that to 1995 James Golick.



### Build Tool 101

Build tools are complicated beasts because they do a lot of different things. But some of the most basic ones 
