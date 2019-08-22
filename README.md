# a blog

Build with jekyll.

Needs python 2 for using pygments. Something like:

```
mkvirtualenv jekyll --python=/usr/local/Cellar/python/2.7.13/bin/python
```

Run dev server:

```
bundle exec jekyll serve
# or
bundle exec jekyll serve --drafts
```

`source` is effectively master branch, and `master` is deployed from `source` using [jekyll-github-deploy](https://github.com/yegor256/jekyll-github-deploy).

Deploy:

```
bundle exec rake deploy
```
