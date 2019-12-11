## GraphQL Query Tutorial (MDX-Deck Presentation Deck)

https://github.com/jxnblk/mdx-deck

https://github.com/jxnblk/mdx-deck/blob/master/docs/exporting.md

Run

```
npm start
```

Build

```
npm run build
```


```
for f in $(ls *.js); do sed -i 's/"\/$f/\/public\/presentations\/graphql_queries\/public\/$f/g' *.js; done
```
