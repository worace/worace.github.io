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
