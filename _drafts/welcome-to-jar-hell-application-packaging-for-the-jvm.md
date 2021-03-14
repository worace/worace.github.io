---
title: "JAR is Hell: A Singed Neophytes Guide to JVM Application Packaging"
layout: post
---

Write once, run anywhere they said. It'll be fun they said. Well, I wish I could explain to 1995 James Gosling that I'm about to upload 4.2GB of `.class` files to the servers of an online bookstore in the hopes that they'll run them on my behalf.

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

So using manual `javac` commands and some careful directory organization, we can give the Classpath/Classloading what it wants:

* One (or more) base directories where classes can be searched for
* Containing class files organized into subdirectories according to their package hierarchy

If needed, we could even wire upa  crude deployment system from this by just `scp`-ing our directory wholesale to some server, `ssh`-ing into it, and running `java Foo`. And people have certainly done this over the years.

But carting around `.class` trees manually gets tedious, so someone came up with a specification for packaging them into bundles called [JAR files](https://docs.oracle.com/javase/8/docs/technotes/guides/jar/jarGuide.html).

A JAR is basically a Zip archive (you can literally unpack them with `unzip`) containing some metadata files and a tree of class files. There are a lot of niche JAR features (special support for Applets, Service loader configuration, content signing, indexing schemes to speed up class loading, etc), but for most of us it's just the standard way to package JVM code.

You can see how these work for yourself by pulling one from a public package archive:

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

All the `META-INF` stuff is metadata describing the packaged code, while the tree of class files corresponds to the compiled Java sources which you can see on [github](https://github.com/kungfoo/geohash-java).

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

## External Dependencies

Package / Library:

* JAR of compiled `.class` files
* Dependency manifest identifying additional transitive dependencies of this package
* Maven conventions: pom.xml
* Alternatives: ivy.xml

So now we can:

* Compile source code into `.class` files
* Bundle multiple compiled sources into an archive (JAR)

### FAQ

* What are all these `$` in my `.class` names


### Resources

https://www.javapubhouse.com/2015/01/episode-47-stop-maven-time.html
https://manifest.fm/6
