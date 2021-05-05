---
title: "CSV to JSON One Liner with Ruby"
layout: post
---

I run into this a lot and figured out a reasonably handy way to do it with built-in ruby tooling.

The one-liner is:

```
ruby -r csv -r json -e 'CSV.new(STDIN, headers: true).each { |r| puts r.to_h.to_json }
```

I put it in by `.zshrc` as a function:

```shell
function csv2json {
  ruby -r csv -r json -e 'CSV.new(STDIN, headers: true).each { |r| puts r.to_h.to_json }'
}
```

So I can use it like:

```
echo 'a,b\n1,2' | csv2json
{"a":"1","b":"2"}
```
