---
title: "JAR is Hell: A Singed Neophytes Guide to JVM Application Packaging"
layout: post
---

Write once, run anywhere they said. It'll be fun they said. Well, I wish I could explain to 1995 James Gosling that I'm about to upload 4.2GB of `.class` files to the servers of an online bookstore in the hopes that they'll run it on my behalf.

## Java Class Compilation Model

* `javac`
* `.class` files
* directory / package convention
* Classloading and the Classpath

## Going Bigger: Packaging Classes into JARs

## Build Tool Evolution: Ant, Maven, and all the rest

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
