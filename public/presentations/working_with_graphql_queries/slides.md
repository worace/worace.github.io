# Working with GraphQL Queries

---

## Goals:

* Dispell some myths
* Build a mental model for working with GraphQL schemas
* Practice writing queries
* Practice reading GraphQL Docs
* **Not focused on server-side tools + implementation today.**

---

# Part 1: Intro

## 1. Background

#### [GraphQL: A Query Language for your API](https://graphql.org/)

* GraphQL is a specification for a JSON-based data protocol
* 2 parts:
  * **Schema-Definition** (Server Side): Define a typed schema for the JSON your server provides
  * **Query Language** (Client Side): Request document fields and specify parameters

---

## 2. Myths + Misconceptions

.pull-left[
* Graph**QL** != S**QL**
* Despite having "Query Language" in the name, the query language is much simpler than something like SQL.

##### because...

* Server declares available fields (via a Schema)
* Clients can only request items from these available fields
* No concepts like joins, unions, CTEs, etc etc
* Doesn't really relate to Graph Databases either

**"JSON Filtering and Parameterization DSL" would be a better name but does not sound as trendy**
]

.pull-right[
```graphql
type User {
  login: String!
  location: String
  name: String
}
type Query {
  viewer: User
}


query {
  viewer {
    login
  }
}
```

**vs...**

```sql
select username from users where id = 1234;
```
]


---

## 3. JSON + HTTP under the hood

.pull-left[
* GraphQL requests are sent via HTTP
* Queries are sent as strings (usually via HTTP POST body) and parsed by the server
* Returned data is sent as JSON
* Query Language filters fields and provides arguments

```graphql
query {
  viewer {
    login
  }
}
```

]

.pull-right[

Equals:

```
curl 'https://api.github.com/graphql
  -H 'Content-Type: application/json'
  --data '{"query":"query {viewer {login}}",
           "variables":{}}}'

(plus a bunch of headers)
```

And gets:

```json
{"data": {"viewer": {"login": "worace"}}}
```

]

---

## 4. Query Syntax =~ JSON - Fields + Arguments

.pull-left[
```graphql
query {
  viewer {
    login
    location
    name
    repositories(first:2) {
      nodes {
        name
      }
    }
  }
}
```
]

.pull-right[
```json
{
  "data": {
    "viewer": {
      "login": "worace",
      "location": "Los Angeles, CA",
      "name": "Horace Williams",
      "repositories": {
        "nodes": [
          {
            "name": "geoq"
          },
          {
            "name": "coque"
          }
        ]
      }
    }
  }
}
```
]

---

## 5. Interlude: GQL Type System

.pull-left[
* GraphQL schemas are typed
* Scalars:
  * Int
  * Float
  * Boolean
  * String
  * ID (String but fancy)
  * Custom Scalars (String but even fancier, e.g. Date, UUID)
* Enums (Server-defined)
* Lists
* Fields can be nullable or not
* Fields can reference scalars or other types
]

.pull-right[
```graphql
type Place {
  id: ID!
  name: String!
  address: String
  categoryIds: [Int]!
  latitude: Float!
  longitude: Float!
  highExistence: Boolean!
  chain: Chain
}
```
]

---

## 6. Interlude: Tooling

GraphQL Schemas are represented as structured data, which makes sophisticated tooling possible.

* [GraphiQL](https://github.com/graphql/graphiql)
* [Prisma GraphQL Playground](https://github.com/prisma-labs/graphql-playground) (e.g. [Factual internal Graph API](http://graph.prod.factual.com/))
* [Github V4 API Developer Playground](https://developer.github.com/v4/explorer/) (Uses GraphiQL)
* [Apollo Client](https://www.apollographql.com/docs/react/)

Not technically part of core GraphQL (Spec describes query format, transport protocol, resolution logic, etc).

But they are fairly ubiquitous and a common part of working with GraphQL.

**Consuming GraphQL in practice = browsing interactive docs + writing queries**

We will practice this using the GitHub V4 API Explorer.

---

# Part 2: Workshop Time

## Let's write some Queries

---

## GitHub V4 API

* GitHub uses GraphQL for v4 of their developer API
* Has an interactive Playground UI at https://developer.github.com/v4/explorer/
* Go there and sign in

<img style="max-height: 40%; max-width: 80%;" src="https://www.dropbox.com/s/gochtw5l8qlu69o/Screenshot-2019-12-10-11-13-06.png?dl=1" />

---

### Playground Overview

<img style="max-height: 75%; max-width: 80%" src="https://www.dropbox.com/s/6vjubv1c1w8g1rc/Screenshot-2019-12-10-11-18-00.png?dl=1" />

---

### Exercise 1: Basic Query, no parameters

Log in to GitHub explorer and query the `viewer` field to get your own:

* login
* location
* name
* email
* employee status
* bio
* avatarUrl

---

## Next Step: Parameters

.pull-left[

* Basic syntax lets us read fields, but we also need to **provide input data**
* Parameters can be accepted at any field in a GQL query (remember it is **JSON Filtering and Parameterization DSL**)
* Standard scalar types, or composites of these
* Used very frequently, so good to get used to them
  * Examples: Search, Filtering, Pagination (very common in GitHub's API)
]

.pull-right[
#### Parameter Syntax:

```
field(paramName: "Value")
```

```
query {
  viewer {
    organization(login:"Factual"){
      login
      location
    }
  }
}
```

**REST Comparison**

* Data that would go in a URL param or POST Body in a REST API goes in a parameter in GQL

`/users/123/repositories?limit=5` **vs**

`query { repositories(userId: 123, limit: 5) { name } }`
]

---

## Exercise 2: Queries with Parameters

Now that we know how to send query parameters, we can access much more of the schema!

1. Using the `user` field, look up your neighbor's github email, database ID, and the names of their first 10 repositories.
2. Using the `organization` field, look up the name and login for the first 10 members of the Factual github org.
3. Using the `organization` field, find Factual's 10 most-starred repositories

---

## Next Step: Mutations

.pull-left[
* `mutation` is the second top-level field in a GQL schema (after `query`)
* "Mutations" represent write operations (Create, Update, Delete)
* Note that (like HTTP Verbs in REST) this is really just by convention
* Syntax is the same
* Mutations are also fields and can return values like normal queries
* Note in the GitHub API, most mutations require an ID as input, so you may need to first run a query to get the ID of the subject you want to interact with
]

.pull-right[

#### Example:

```
mutation {
  followUser(input:{userId:"MDQ6VXNlcjU3NzA2NjA="}) {
    user {
      viewerCanFollow
      viewerIsFollowing
    }
  }
}
```

```
{
  "data": {
    "followUser": {
      "user": {
        "viewerCanFollow": true,
        "viewerIsFollowing": true
      }
    }
  }
}
```
]

---

## Exercise 3: Mutations

Use mutations in the GitHub API Explorer to:

1. Star a Repo (you can use "worace/test-repo" if you don't want to use another one)
2. Follow your neighbor
3. Add a reaction to [this issue](https://github.com/worace/test-repo/issues/1)

(Hint for number 3: Look up the ID using:)

```graphql
query {
  repository(name:"test-repo", owner:"worace") {
    issues(first:5){
      nodes {
        id
        title
      }
    }
  }
}
```

---

### Named Queries and Variables

As your queries become more complex, you may want to re-use a query with different parameters.

GraphQL supports this with "named queries" and variables:

.pull-left[

```graphql
query IssuesForRepo($name: String!, $owner:String!){
  repository(name:$name, owner:$owner){
    issues(first:5){
      nodes {
        id
        title
      }
    }
  }
}
```

with Variables:

```json
{"name": "test-repo", "owner": "worace"}
```
]

.pull-right[
```json
{
  "data": {
    "repository": {
      "issues": {
        "nodes": [
          {
            "id": "MDU6SXNzdWU1MzYwMDU2MDc=",
            "title": "Test Issue for Reactions"
          }
        ]
      }
    }
  }
}
```

**Named Queries are great because they integrate well with...**
]

---

### Programmatic Clients

.pull-left[


Explorer UIs like GraphiQL are great for discovery and experimentation.

But for production use, you'll likely want to use a programmatic GraphQL client:

* [github/graphql-client](https://github.com/github/graphql-client) (Ruby)
* [graphql-python/gql](https://github.com/graphql-python/gql) (Python)
* [prisma-labs/graphql-request](https://github.com/prisma-labs/graphql-request) (JS)
* [apollographql/apollo-client](https://github.com/apollographql/apollo-client) (JS)
* [Jarlakxen/drunk](https://github.com/Jarlakxen/drunk) (Scala)
* (Or just use an HTTP client and roll your own!)

]

.pull-right.text-sm[
Python Example:

```python
from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport

transport = RequestsHTTPTransport(
  url='http://graph.prod.factual.com/graphql',
  use_json=True
)

client = Client(
  transport=transport,
  fetch_schema_from_transport=True
)

query = gql(
  '''
  query($chain_id: String!) {
    search(filters: {country: "us", chainId: $chain_id}) {
      id
      name
    }
  }
  '''
)

vars = {'chain_id': "ab4a6b90-d68a-012e-5619-003048cad9da"}

client.execute(
  query,
  variable_values = vars
)
```
]

---

### Further Research / Advanced Topics

* [Query Aliases](https://graphql.org/learn/queries/#aliases) (use the same field multiple times in one request, e.g. fetch multiple users at a time)
* [Fragments](https://graphql.org/learn/queries/#fragments) (Re-use shared query logic between multiple queries)
* [Interfaces](https://graphql.org/learn/schema/#interfaces) (Polymorphism in GraphQL type system)
* [Error Handling](https://www.youtube.com/watch?v=A5-H6MtTvqk) (Lots of ways; TL;DR errors can be returned at top level next to "data" and at sub-fields. Tries to return errors as values in the payload rather than giving HTTP 500).
* [Subscriptions](https://github.com/graphql/graphql-spec/blob/master/rfcs/Subscriptions.md) (Stream graphql fields as real time events -- not finalized)

#### Broader Picture

* GraphQL Benefits
  * Flexible field specific
  * **Typed Schema**
  * Standardized client-side tooling
* Costs?
* Is GraphQL good?
* Alternatives: **[gRPC](https://grpc.io/)**, [finagle](https://twitter.github.io/finagle/), [OpenAPI / Swagger](https://swagger.io/docs/specification/about/), [jsonapi.org](https://jsonapi.org/), [Cap'n Proto](https://capnproto.org/)

> For new network services, we should think seriously about how to provide a typed and schematized interface, whether that's with GraphQL or some other tool.

---

## Closing - Go Play / Q&A

Keep experimenting with queries in the GitHub Explorer. Or, here are some other GraphQL APIs to try:

* [Factual Graph API](http://graph.prod.factual.com/graphql)
  * What's the place with highest placerank within 500m of the office (34.058679, -118.4165)
  * How many Pizza Huts (Chain ID `ab4a6b90-d68a-012e-5619-003048cad9da`) are there in the world? In the US?
* [Yelp](https://www.yelp.com/developers/graphiql)
* [SWAPI](https://graphql.org/swapi-graphql/) (Example API using Star Wars data)
* [Pokemon API](https://graphql-pokemon.now.sh/) (Ditto, but for Pokemon)
