---
title: "JAR is Hell: A Singed Neophytes Guide to JVM Application Packaging"
layout: post
---

Write once, run anywhere they said. It'll be fun they said. Well, I wish I could explain to 1995 James Gosling that I'm about to upload 4.2GB of `.class` files to the servers of an online bookstore in the hopes that they'll run them on my behalf.

This is Part 1 of a 2-part series about Application Packaging and Dependency Management on the JVM. This section covers some of the basics of the JVM's compilation and packaging model. Part 2 investigates some of the problems that arise especially when managing dependencies for larger projects.

If you're a newcomer to the JVM or if you just have the particular type of brain worms that motivate you to read 5000 words about JARs, Classpaths, POMs, this may be of interest. In either case I am sorry for you.

## Summary / TL;DR
## Java Class Compilation Model

As you may have learned in your first "Hello World" intro to Java, the JVM consumes our code in the format of compiled `.class` files rather than as raw `.java` source files. Class files contain bytecode instructions the JVM understands, rather than the raw machine code hardwired into your processor.

We often deal with `.class` compilation via build tools, but the simplest way to produce them is via `javac` directly:

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

It's worth noting that while the JVM's class and object model resonates closely with that of the Java language, they're not fundamentally linked. The wide range of non-Java JVM languages show that other compilers can target this format just fine, although the results may require `.class` encodings of things we wouldn't think of as very class-like.

## Classloading, the Classpath, and Package/Directory Conventions
When running something like `java Hello`, the `Hello` is actually the name of a Class, and the JVM has to go and fetch it in order to execute the code it contains. Just like your system uses the `PATH` variable to know where to look for executables, the JVM uses a [Classpath](https://docs.oracle.com/javase/tutorial/essential/environment/paths.html) setting to tell it where to search for `.class` files corresponding to a requested class name.

Classpaths can become incredibly complex, but the default one is just `.`, so our previous example works because the `Hello.class` definition matching the class named `Hello` is sitting in the current directory, and the JVM is able to find it. (The actual loading of compiled `.class` files into memory is accomplished by another component, called a [Classloader](https://www.baeldung.com/java-classloaders) which is mostly beyond the scope of this discussion, but provides yet another layer of subtlety in the whole process.)

In practice, Java code is usually organized into packages, and most implementations follow the [conventions](https://docs.oracle.com/javase/tutorial/java/package/managingfiles.html) of expecting class files to be organized in a corresponding directory hierarchy.

So a more realistic example might be:

```java
// example/Pizza.java
package example;

import example.Calzone;

public class Pizza {
  public static void main(String[] args) {
    System.out.println(Calzone.yum);
  }
}
```

```java
// example/Calzone.java
package example;

public class Calzone {
  public static String yum = "yummm";
}
```

Now we have 2 class interacting via an import. We can compile the whole structure: ``.

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

This loads 2 of our classes: `example.Pizza`, which we triggered explicitly, and `example.Calzone`, which `example.Pizza` imports. In both cases, the classloader is able to find these by traversing the default classpath (`.`) to find the corresponding class files (`Pizza.class` and `Calzone.class`) under the directory (`./example/`) which corresponds to their package name.

## Packaging Classes into JAR Files
So using manual `javac` commands and some careful directory organization, we can produce a Classpath which gives the Classloader what it wants:

* One (or more) searchable base directories containing...
* Class files organized into subdirectories according to their package hierarchy

If needed, we could even wire up a crude deployment system from this by just `scp`-ing our directory wholesale to some server, `ssh`-ing into it, and running `java Foo`. And people have certainly done this over the years.

But carting around `.class` trees manually gets tedious, so someone came up with a specification for packaging them into bundles called [JAR files](https://docs.oracle.com/javase/8/docs/technotes/guides/jar/jarGuide.html).

A JAR is basically a Zip archive (you can literally unpack them with `unzip`) containing some metadata files and a tree of class files. There are a lot of niche JAR features (special support for Applets, Service loader configuration, content signing, indexing schemes to speed up class loading, etc), but for most of us it's just the standard way to package JVM code.

You can see how these work for yourself by pulling one from a public package archive and unpacking it:

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
   creating: ch/hsr/geohash/queries/
  inflating: ch/hsr/geohash/util/VincentyGeodesy.class
  inflating: ch/hsr/geohash/util/TwoGeoHashBoundingBox.class
  inflating: ch/hsr/geohash/util/GeoHashSizeTable.class
  inflating: ch/hsr/geohash/util/BoundingBoxGeoHashIterator.class
  inflating: ch/hsr/geohash/util/LongUtil.class
  inflating: ch/hsr/geohash/util/BoundingBoxSampler.class
  inflating: ch/hsr/geohash/WGS84Point.class
  inflating: ch/hsr/geohash/GeoHash.class
  inflating: ch/hsr/geohash/BoundingBox.class
  inflating: ch/hsr/geohash/queries/GeoHashCircleQuery.class
  inflating: ch/hsr/geohash/queries/GeoHashQuery.class
  inflating: ch/hsr/geohash/queries/GeoHashBoundingBoxQuery.class
   creating: META-INF/maven/
   creating: META-INF/maven/ch.hsr/
   creating: META-INF/maven/ch.hsr/geohash/
  inflating: META-INF/maven/ch.hsr/geohash/pom.xml
  inflating: META-INF/maven/ch.hsr/geohash/pom.properties

$ tree ch
ch
└── hsr
    └── geohash
        ├── BoundingBox.class
        ├── GeoHash.class
        ├── WGS84Point.class
        ├── queries
        │   ├── GeoHashBoundingBoxQuery.class
        │   ├── GeoHashCircleQuery.class
        │   └── GeoHashQuery.class
        └── util
            ├── BoundingBoxGeoHashIterator.class
            ├── BoundingBoxSampler.class
            ├── GeoHashSizeTable.class
            ├── LongUtil.class
            ├── TwoGeoHashBoundingBox.class
            └── VincentyGeodesy.class
```

Everything under `META-INF/` is metadata describing the packaged code, while the tree of class files corresponds to the compiled Java sources which you can see on [github](https://github.com/kungfoo/geohash-java).

Most JVM tools understand JAR files, and **can use them directly as part of the classpath**:

```
# Launch the scala repl with this JAR on the classpath
$ scala -classpath geohash-1.3.0.jar
scala> import ch.hsr.geohash.GeoHash
import ch.hsr.geohash.GeoHash
```

So while we saw some examples of a Classpath containing raw `.class` files, it's also common to use a directory of JAR files, representing libraries retrieved from a package registry, perhaps in combination with locally generated `.class` files representing our own code.

All of this can get quite complicated, so it's generally managed by...

## Build Tools: Ant, Maven, et al.
* Ant: Make-like build tool engine
* Maven: convention-based workflows
  * `pom.xml`
* compile code to class files
* bundle class files into JARs

## Libraries and External Dependencies

JAR files provide a standard mechanism for bundling compiled JVM code, but they're fairly agnostic about what the intent or provenance of that code. In particular the JAR format itself does not include any provisions for describing the relationship between multiple packages, in the way we would expect from a modern software library and dependency management system.

These things can be incredibly tricky to nail down, and it took the JVM ecosystem a long time to coalesce around a standard. In the very early days, people simply managed library distribution by hand, via shell scripts, File servers, or even just emailing JAR files around. Then there was a generation of "Build-a-Build" build tools, most famously [Ant](https://ant.apache.org/), which provided some Make-like utilities for scripting common compilation and JAR management tasks.

Finally [Maven](https://maven.apache.org/) came on the scene, and while it's still a very popular build tool in its own right, it's also established many of the dependency management conventions used throughout the JVM ecosystem. Maven codified the evolving conventions around distributing JVM code as libraries and expressing dependencies between them.

In Maven, a library consists of:

1. A JAR containing compiled JVM class files. Generally Maven-style library JARs contain only the library's own code, sometimes called a "thin" JAR.
2. A project identifier consisting of a Group ID, Artifact ID, and version. This serves as a unique coordinate for a package in a repository.
3. A list of dependencies, expressed in the same Group/Artifact/Version format

Maven describes items 2 and 3, as well as other metadata about a package using a `pom.xml` file (sometimes written as `<package>-<version>.pom`). POM files can be configured for a dizzying number of use cases, but in the context of library management they're used similarly to `package.json` in NPM, `.gemspec` in Bundler, or `Cargo.toml` in Cargo.

A number of other JVM build tools have arisen over the years ([Leiningen (Clojure)](https://leiningen.org/), [sbt (scala)](https://www.scala-sbt.org/), [Gradle](https://gradle.org/), not to mention the "monorepo" tools like [Pants](https://www.pantsbuild.org/) and [Bazel](https://bazel.build/)) but Maven has become a lingua franca in the ecosystem, and other tools generally support both consuming and producing Maven-style POMs and JARs.

[Maven Central](https://maven.apache.org/) is a well-known public repository for publishing Maven-style libraries, and there are many commercial and OSS tools for hosting your own repository, which many companies use internally for private packages.

https://repo1.maven.org/maven2/works/worace/circe-geojson-core_2.12/0.2.0/



So now we can:

* Compile source code into `.class` files
* Bundle multiple compiled sources into an archive (JAR)

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
