# `AXTORE`

Apollo store for Axon web app

## Motivation

Apollo client is powerful but it hard for new user. It takes much time to understand caching, fetching, mutating models. It also hard to handle multiple query fetching logics in sequence. With Axtore developer can centralize app logics, or make an scalable app with ease. Axtore also makes data fetching logics more simplifier, we totally separate app logics with React, that means Axtore can work with Vanilla Javascript.

## Features

- Support state logic: valued and computed state
- Support dynamic query/mutation
- Support strong typed queries or mutations
- Support side effects, developers can handle preloading, polling, data caching/clean up easily

## Core concepts

- State: Where to store simple value (synchronous value)
- Query: Where to handle async data loading logic
- Mutation: Where to handle async data updating logic
- Effect: Where to handle side effects

## Creating a first model

We use `model` function to create a Axtore model. A model contains all logics (state, query, mutation, effect) of the app.

```ts
import { model } from "@axon/axtore";

const counterModel = model()
  // define an `count` state, state is where to store simple value
  .state("count", 1)
  // define a `increment` mutation, in mutation scope, we can mutate query/state, refetch query
  .mutation("increment", async (args: void, { $count }) => {
    $count((prev) => prev + 1);
  });

// `client` is ApolloClient object
const d1 = counterModel.call(client, ({ $count }) => $count());
console.log(d1); // 1
// dispatching mutation
await counterModel.call(client, (x) => x.$increment());
const d2 = counterModel.call(client, ({ $count }) => $count());
console.log(d2); // 2
```

## Working with React

We use createHooks function to create a set of hooks from specified model and using that hooks to consume state/query/mutation in React component

```ts
import { createHooks } from "@axon/axtore/react";
import counterModel from "./counterModel";

// `meta` prop contains logic (query, mutation, state) of the model
const { useCount, useIncrement } = createHooks(counterModel.meta);

const CounterApp = () => {
  const count = useCount();
  const { mutate } = useIncrement();

  return (
    <>
      <h1>{count}</h1>
      <button onClick={() => mutate()}>Increment</button>
    </>
  );
};
```

## Extending model

```ts
const baseModel = model().query("q1");
// when we call any definition factory (query/state/mutation), a new model is created and extend all metadata from previous model
const model1 = model().query("q2"); // model1 has q1 and q2
const model2 = model().query("q3"); // model2 has q1 and q3
// we also use model.use() to extend metadata from other models
const model3 = model().use({
  ...model1.meta,
  ...model2.meta,
}); // model3 has q1, q2, q3
```

## Code splitting

If we have a query/mutation that contains very complex logic or has many heavy imports we can split model definition into multiple files

```ts
const appModel = model()
  .query("complexQuery", async (args: QueryVariables) => {
    const { default: fn } = await import("./complexQuery");
    return fn(args);
  })
  .query("complexMutation", async (args: MutationVariables) => {
    const { default: fn } = await import("./complexMutation");
    return fn(args);
  });
```

## Using side effect

We can define side effects for model by using model.effect()

```ts
import { gql } from "@axon/axtore";

const appModel = model()
  .state("token", "")
  // a query fetches too much data
  .query(
    "todoList",
    gql`
      query {
        todoList
      }
    `
  )
  .query(
    "userProfile",
    gql`
      query {
        userProfile
      }
    `
  )
  .effect(
    ({ $todoList, $token, $userProfile }) => {
      // prefetching todoList once model is ready
      $todoList();

      $token.on({
        change(value) {
          // if user is logged out, perform cleanup
          if (!value) {
            $userProfile.evict();
          }
        },
      });

      setInterval(() => {
        // do data pooling in every 10s
        $userProfile();
      }, 10000);
    },
    () => {
      // other effect
    },
    () => {
      // other effect
    }
  );
```

**When side effects are triggered?**
Side effects are triggered in initializing phase of the model (see [Model life cycle](#model-life-cycle-and-inheriting) )

## Model life cycle and inheriting

Let say we have following model

```ts
const baseModel = model().query("q1");
// this model is inherited from baseModel, it has q1 and q2 queries
const derivedModel = baseModel.query("q2");
const otherModel = model().query("q3");
// this is compound of 2 models derivedModel and otherModel, so it has q1, q2, q3 queries
const compoundModel = model().use({
  ...derivedModel.meta,
  ...derivedModel.meta,
});
```

When we do some action on the compoundModel with specified client, compoundModel do initializing first. It start analyzing its metadata and see there are 3 queries:

- q1 query belongs to baseModel
- q2 query belongs to derivedModel
- q3 query belongs to otherModel

The compoundModel calls baseModel to do initializing. baseModel registers q1 query to the client. Then compoundModel calls derivedModel to do initializing, and there are 2 queries belonging to it (q1, q2). In fact, q1 query belongs to baseModel, so derivedModel needs to call baseModel for initializing first. But the baseModel is already initialized, it does nothing. The initialization process is the same as for the otherModel.

What initializing process does?

- Registering state/query/mutation to client
- Doing side effects

```ts
// initializing happens when we call some action on specified client
compoundModel.call(client, ({ $q3 }) => {
  $q3();
});

// or it happens when the model's hooks are consumed by React component
const { useQ3 } = createHooks(compoundModel);
const App = () => {
  const { data, loading } = useQ3();
};
```

## Model dispatcher

When we define state/query/mutation, model just add that definition to its metadata, nothing actually is created. Until we dispatch some action or dynamic query/mutation is executing, the state/query/mutation dispatchers will be created at that time. We can access model's dispatchers inside computed state context, action context, dynamic query/mutation context

```ts
const appModel = model()
  .query("todoList", TODO_LIST_QUERY)
  .query("otherQuery", (args, context) => {
    // we can access todoList by dynamic query context
    console.log(context.$todoList);
    // but we cannot access dispatcher of current query
    console.log(context.$otherQuery); // an error will be thrown
  });

appModel.call(client, (context) => {
  // we can also access all dispatchers of the model by action context
  console.log(context.$todoList);
  console.log(context.$otherQuery);
});
```

**There are some conventions for dispatcher:**

- The first character of query/state/mutation name must be lower case (pascal-case)
- Model generates dispatchers prefixed with `$` character. This makes sure the dispatcher names has no conflict with other user context props

### State dispatcher

```ts
model()
  .state("count", 0)
  .state("todos", [])
  .mutation("increment", (args: void, { $count }) => {
    // call state getter
    console.log($count()); // 0
    // call state setter
    $count($count() + 1); // 1
    // call state setter with reducer. the reducer receives a previous value and returns a new value
    $count((prev) => prev + 1); // 2
  })
  .mutation("addTodo", (args: Todo, { $todos }) => {
    // update state value using immer recipe
    // axtore uses immer for state updating underneath
    $todos((todos) => {
      todos.push(args);
    });
  });
```

### Query dispatcher

### Mutation dispatcher

## API References

### model(options?: ModelOptions): Model

Create a model obj with specified options

### ModelOptions

### model.state(name: string, value: any, options?: StateOptions): Model

Create a new model that includes the state definition

### model.state(name: string, computeFn: Function, options?: StateOptions): Model

Create a new model that includes the computed state

### StateOptions

### model.query(name: string, document: DocumentNode, options?: QueryOptions): Model

### model.query(name: string, queryFn: Function, options?: QueryOptions): Model

Create a new model that includes the dynamic query definition

- queryFn() accepts following parameters

  - args: a query variables. In Typescript, if args has `void` type, that means we don't need to pass any args when dispatching query

  ```ts
  const appModel = model()
    .query("withArgs", (args: { value: number }) => {})
    .query("noArgs", (args: void) => {});

  appModel.call(client, ({ $withArgs, $noArgs }) => {
    $noArgs();
    $withArgs({ value: 1 });
  });
  ```

  - context: a query context that includes other model dispatchers and user context values

### QueryOptions

The QueryOptions object has following props:

- type(string): model will use this type name to assign \_\_typename to the data of dynamic query

```ts
const appModel = model()
  // type patching works with single object
  .query("todoDetails", () => ({ id: 1 }), { type: "Todo" })
  // type patching works with array of object
  .query("todoList", () => [{ id: 1 }, { id: 2 }], { type: "Todo" });
const { todoDetails } = await appModel.call(client, (x) => x.$todoDetails());
const { todoList } = await appModel.call(client, (x) => x.$todoList());
console.log(todoDetails); // { id: 1, __typename: 'Todo' }
console.log(todoList); // [{ id: 1, __typename: 'Todo' }, { id: 2, __typename: 'Todo' }]
```

### model.mutation(name: string, document: DocumentNode, options?: MutationOptions): Model

### model.mutation(name: string, queryFn: Function, options?: MutationOptions): Model

### MutationOptions

- type(string): model will use this type name to patch the data of dynamic mutation

### model.effect(...effectFn: Function[]): Model

Create a new model that includes the given side effects. [See Using side effects](#using-side-effect)

### createHooks(modelMeta: Object): HookMap

Create a set of hooks according to model metadata shape

```ts
import { model, gql } from "@axon/axtore";
import { createHooks } from "@axon/axtore/react";

const appModel = model()
  .state("count", 1)
  .query("userProfile", gql``)
  .mutation("doSomething", gql``);

const hooks = createHooks(appModel.meta);

console.log(hooks.useCount); // state hook useCount()
console.log(hooks.useUserProfile); // query hook useUserProfile()
console.log(hooks.useDoSomething); // mutation hook useDoSomething()

// create prefixed hooks
const prefixedHooks = createHooks(appModel.meta, { prefix: "App" });
console.log(hooks.useAppCount);
console.log(hooks.useAppUserProfile);
console.log(hooks.useAppDoSomething);

// combine multiple metadata
const otherModel = model().query("todoList");
const combinedHooks = createHooks({ ...appModel.meta, ...otherModel.meta });
console.log(hooks.useCount);
console.log(hooks.useUserProfile);
console.log(hooks.useDoSomething);
console.log(hooks.useTodoList);
```

#### Query Hook

#### Mutation Hook

#### State Hook
