---
title: "Grids Grids Grids"
subtitle: "Notes on spatial grids: S2, H3, and Geohash"
layout: post
---

Recently there was some very interesting discussion on Twitter about H3, Uber's hexagonal spatial grid system.

<blockquote class="twitter-tweet"><p lang="en" dir="ltr">do any geospatial people get the argument for h3 (the hexagon indexing/tiling thing)?</p>&mdash; Tom MacWright (@tmcw) <a href="https://twitter.com/tmcw/status/1375510900384227328?ref_src=twsrc%5Etfw">March 26, 2021</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

That thread raised a lot of great points about comparisons between H3 and other similar tools. Since I've also often found myself in the position of having to evaluate these options before, I thought I would write up some notes about my own experience with the problem H3 and similar libraries aim to solve, and some of the tradeoffs of the different options.

## Problem Statement + Use Case

## Terminology

* Index
* Distributed
* Hierarchical

## User bases

Sick maps in jupyter notebooks crowd vs Hadoop cluster go brrr crowd

## Overview

### Geohash

### S2

S2 is a very interesting beast. It's a classic example of "reinvent the whole stack from scratch"

Most OSS geometry libs (geos, shapely, turf, JTS, etc) are _planar_. They use good old Euclidean geometry like you learned in 9th grade. This means that certain operations will be less accurate when applied to geographic features on the earth, which inherently exist on a curved surface. The general response from the spatial technology industry is to either a) get into specialized localized map projections or b) shrug and just ignore the issue.

https://github.com/google/s2-geometry-library-java/issues/3
https://medium.com/sidewalk-talk/s2-cells-and-space-filling-curves-keys-to-building-better-digital-map-tools-for-cities-a312aa5e2f59
https://www.sidewalklabs.com/blog/s2-cells-and-space-filling-curves-keys-to-building-better-digital-map-tools-for-cities/

https://blog.christianperone.com/2015/08/googles-s2-geometry-on-the-sphere-cells-and-hilbert-curve/
https://news.ycombinator.com/item?id=10066616
https://opensource.googleblog.com/2017/12/announcing-s2-library-geometry-on-sphere.html
https://docs.google.com/presentation/d/1Hl4KapfAENAOf4gv-pSngKwvS_jwNVHRPZTTDzXXn6Q/view#slide=id.i0

http://blog.notdot.net/2009/11/Damn-Cool-Algorithms-Spatial-indexing-with-Quadtrees-and-Hilbert-Curves
https://www.drdobbs.com/database/space-filling-curves-in-geospatial-appli/184410998

https://www.fastcompany.com/3007394/how-foursquare-building-humane-map-framework-rival-googles

https://link.springer.com/article/10.1007/s41019-020-00147-9

https://blog.nobugware.com/post/2016/geo_db_s2_geohash_database/

https://developers.google.com/earth-engine/guides/geometries_planar_geodesic

S2 in browser with WASM https://github.com/akhenakh/ws2
### H3

## Point by point comparisons

### Aesthetics

Hexagons look cool. Putting some vaporwave hexagons on a dark mode map can win people over to your idea before you even start explaining it.

### The Algorithms / How they work

Geohash - very simple. Also optimizable

H3...

Icosahedron

Fun fact: icosahedron with pentagons in water

Ex: I once spent a frivolous amount of time on porting H3 line by line to rust, and I still don’t really understand the process

S2...

Unit sphere to unit square

### Spatial sorts and space-filling curves

### Binary Cell Representations

### Hierarchy / nesting

### Performance

### Availability

Geohash: everywhere

S2: Java, c++, go. Some other langs using c bindings.  No native js implementation

H3: written in c. Java via jni. Other Lang’s via c bindings. Does have a native JS impl thanks to emscripten.

### Other goodies

H3: directed edge analysis

S2: geodesic fundamentally

## Use cases

So why are these things so useful anyway?

Quantization / discretization.

Allow you to describe spatial regions with very compact discrete identifiers (64 bits)

This turns out to be quite powerful, because it makes it easy to distribute certain kinds of computations.

Traditionally spatial data was often indexed with some variation of an R tree. This is basically a B* tree adapted to index arbitrary spatial envelopes.

Unfortunately tree based indexes are harder to distribute and shard. Many data systems in the last 10-15 years have moved toward heavily key-value oriented indexing schemes, and a global grid system allows you to express spatial data in this context.

## Other Alternatives

https://lambda.gsfc.nasa.gov/product/cobe/skymap_info_new.cfm
https://healpix.jpl.nasa.gov/
http://skyserver.org/HTM/
