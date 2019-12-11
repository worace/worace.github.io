# GraphQL ( + Factual? )

* [ ] GraphQL Logo
* [ ] Factual Logo

```graphql
query {
  place {
    id
    name
    pizza
    categories {
      id
      label
    }
  }
}
```

---

# Intro - Spec + Overview

- definition: graphql is an application-level query language...etc
- started at facebook but now has its own foundation, standards committee, etc

# Schema Declaration

- schematized
  - schema example
- declarative
- typed
- Syntax: "JSON without the values"

# GQL Type System

- Scalars
  - Int
  - Float
  - String
  - Boolean
- Lists
- Enums
- Nullability -- Fields are nullable by default but can be declared non-null
- Interfaces
- Unions
- Types can be self-referential
- No generics (more on this later)


# Schema Benefits (section?)

## Query Validation

- [ ] Show an error example
- [ ] Good tooling even allows coercion into proper types for a programming lang (show scala code snippet?)

## Documentation Generation

# Implementation (Server-Side)

## Query Resolution

- Different mindset from implementing a "static" JSON API, because the data you're fetching is dynamic
- 

# Implementation (Server-Side)

- Resolvers
- Comparison vs e.g. SQL -- designed to be implemented by applications
- High level: Implement a "Resolver" for each field
- Lot of open-source tooling around generating and resolving schemas

# Implementation (Gotchas)

- N+1 / Deferred fetching
- Query complexity
- Authentication (easy)
- Authorization (can be hard) -- usually done per-field

# Common GQL Gotchas

- server-side implementation is not trivial
- No Generics -- Difficult to deal with open-ended data like "Map of String to Int". People end up doing things like defining their own custom scalars to serialize JSON
- Traditional HTTP caching approaches may not work
  - GQL requests usually sent as HTTP POST (most browsers won't cache)
  - Payload contents depend on request body, not URL, so traditional CDN/eTag caching won't work

# Is GraphQL Overhyped?

## Almost Certainly

But it can be overhyped and still be good for some things


# GQL + Factual

What are the proposed benefits

- Multi-client flexibility (meh)
- Avoid overfetching (good to meh?)
- Query batching (1 request, many queries) -- (meh?)
- Fancy client-side tooling (e.g. Apollo) - caches, denormalization, etc (meh)
- Optional graph/relationship traversal (yes)
- Automated up to date documentation (super yes)
- Structural validation / "Types on the Wire" (super yes)

# Alternatives:

- Documentation-only tools (swagger -- link to mastermind)
  - This ship has sailed and mostly crashed among the rocks
- Binary RPC protocols (**GRPC** / Finagle)
  - Strong argument to be made
  - Much less human-friendly / more tooling required





