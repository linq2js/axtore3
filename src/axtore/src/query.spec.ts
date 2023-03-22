import { cleanFetchMocking, createClient } from "./testUtils";

import { OperationTypeNode } from "graphql";
import { createStore } from "./createStore";
import { delay } from "./util";
import { gql } from "./types";

const STORE_GQL = gql`
  fragment CommonProductProps on Product {
    id
    name
  }

  query GetValue($value: Int) {
    value(value: $value) @client
  }

  query GetProducts($limit: Int) {
    products(limit: $limit) @client {
      ...CommonProductProps
    }
  }

  query GetProductsWithAlias($limit: Int) {
    fieldAlias: resolverName(limit: $limit) @client {
      ...CommonProductProps
    }
  }

  query GetDetailedProducts($limit: Int) {
    products(limit: $limit) @client {
      ...CommonProductProps
      description @client
      details {
        id
      }
    }
  }

  query GetProductGroup($limit: Int) {
    one(limit: $limit) @client {
      ...CommonProductProps
    }

    two(limit: $limit) @client {
      ...CommonProductProps
    }
  }

  query GetRating {
    # rating field
    rating @client
  }

  query GetSum {
    sum @client
  }
`;

const baseStore = createStore(STORE_GQL);

type Product = { id: number; name: string };
type GetProductsVariables = { limit: number };
type GetProductsData = { products: Product[] };
type GetProductsWithAliasData = { fieldAlias: Product[] };
type GetValueVariables = { value: number };
type GetValueData = { value: number };
type GetDetailedProductsData = {
  products: (Product & { details: {}; description: string })[];
};
type GetProductGroupsData = { one: Product[]; two: Product[] };

const products: Product[] = new Array(100).fill(0).map((_, index) => ({
  __typename: "Product",
  id: index + 1,
  name: `Product ${index + 1}`,
}));

cleanFetchMocking();

describe("static query", () => {
  test("should throw an error if specific named query not found", () => {
    expect(() =>
      baseStore.use(({ query }) => ({
        GetProductsXXX: query<GetProductsVariables, GetProductsData>(),
      }))
    ).toThrowError(
      `No ${OperationTypeNode.QUERY} named 'GetProductsXXX' found`
    );
  });

  test("static query", async () => {
    const client = createClient({
      resolvers: {
        Query: {
          products: (_, { limit }) => products.slice(0, limit),
        },
      },
    });

    const store = baseStore.use((x) => ({
      GetProducts: x.query<GetProductsVariables, GetProductsData>(),
    }));

    const r1 = await store.defs.GetProducts.use(client).get({
      variables: { limit: 1 },
    });

    const r2 = await store.defs.GetProducts.use(client).get({
      variables: { limit: 2 },
    });

    expect(r1).toEqual({ products: products.slice(0, 1) });
    expect(r2).toEqual({ products: products.slice(0, 2) });
  });
});

describe("dynamic query", () => {
  test("single field query", async () => {
    const client = createClient();
    const store = baseStore.use(({ query }) => ({
      GetProducts: query((args: GetProductsVariables) =>
        products.slice(0, args.limit)
      ),
    }));

    const r1 = await store.defs.GetProducts.use(client).get({
      variables: { limit: 1 },
    });

    const r2 = await store.defs.GetProducts.use(client).get({
      variables: { limit: 2 },
    });

    expect(r1).toEqual({ GetProducts: products.slice(0, 1) });
    expect(r2).toEqual({ GetProducts: products.slice(0, 2) });
  });

  test("specified field name", async () => {
    const client = createClient();
    const store = baseStore.use(({ query }) => ({
      GetProducts: query("products", (args: GetProductsVariables) =>
        products.slice(0, args.limit)
      ),
    }));

    const r1 = await store.defs.GetProducts.use(client).get({
      variables: { limit: 1 },
    });

    const r2 = await store.defs.GetProducts.use(client).get({
      variables: { limit: 2 },
    });

    expect(r1).toEqual({ products: products.slice(0, 1) });
    expect(r2).toEqual({ products: products.slice(0, 2) });
  });

  test("auto type mapping", async () => {
    const client = createClient();
    const ProductType = {
      name: "Product",
      fields: {
        // field resolver
        description: () => "description",
        details: {
          name: "ProductDetails",
        },
      },
    };
    const store = baseStore.use(({ query }) => ({
      GetDetailedProducts: query(
        "products",
        (_: GetProductsVariables) => [
          { id: 1, name: "Product 1", details: { id: 1 } },
          { id: 2, name: "Product 2", details: { id: 2 } },
        ],
        ProductType
      ),
    }));

    const r = await store.defs.GetDetailedProducts.use(client).get();

    expect(r).toEqual({
      products: [
        {
          __typename: "Product",
          id: 1,
          name: "Product 1",
          description: "description",
          details: { __typename: "ProductDetails", id: 1 },
        },
        {
          __typename: "Product",
          id: 2,
          name: "Product 2",
          description: "description",
          details: { __typename: "ProductDetails", id: 2 },
        },
      ],
    });
  });

  // test("lazy value", async () => {
  //   const client = createClient();
  //   // define query
  //   const store = baseStore.use("GetRating", ({ query, lazy }) =>
  //     query<void, { rating: number }>({
  //       resolve: {
  //         rating: () =>
  //           lazy(
  //             // default value
  //             1,
  //             // lazy value loader
  //             async () => {
  //               // return lazy value after 10ms
  //               await delay(10);
  //               return 2;
  //             }
  //             // we can also indicate lazy load options { interval: xxxx }
  //           ),
  //       },
  //     })
  //   );

  //   // get query data first time
  //   const r1 = await store.defs.GetRating.use(client).get();
  //   // wait for lazy value fetched
  //   await delay(20);
  //   // try to get query data second time
  //   const r2 = await store.defs.GetRating.use(client).get();

  //   expect(r1).toEqual({ rating: 1 });
  //   expect(r2).toEqual({ rating: 2 });
  // });

  test("change listener should be removed once the query refetches", async () => {
    const client = createClient();
    const logs: string[] = [];
    const store = baseStore
      .use(({ atom }) => ({
        Counter: atom(1),
      }))
      .use(({ query }, { Counter }) => ({
        GetValue: query("value", (_: GetValueVariables, { on }) => {
          logs.push("GetValue.fetch");
          on(Counter, () => {
            logs.push("Counter.change");
          });
          return 1;
        }),
      }));

    await store.defs.GetValue.use(client).get();
    expect(logs).toEqual(["GetValue.fetch"]);
    await store.defs.GetValue.use(client).refetch();
    expect(logs).toEqual(["GetValue.fetch", "GetValue.fetch"]);
    store.defs.Counter.use(client).set({ data: 2 });
    await delay(10);
    expect(logs).toEqual([
      "GetValue.fetch",
      "GetValue.fetch",
      "Counter.change",
    ]);
  });

  // test("effect", async () => {
  //   let runs = 0;
  //   let disposes = 0;
  //   const client = createClient();
  //   const store = baseStore.use("GetValue", ({ query }) =>
  //     query<GetValueVariables, GetValueData>({
  //       resolve: {
  //         value: (_, { effect }) => {
  //           effect(({}) => {
  //             const timer = setTimeout(() => {
  //               runs++;
  //             }, 10);
  //             return () => {
  //               clearTimeout(timer);
  //               disposes++;
  //             };
  //           });
  //           return 1;
  //         },
  //       },
  //     })
  //   );

  //   store.defs.GetValue.use(client).get();
  //   await delay(15);
  //   expect(runs).toBe(1);
  //   await delay(15);
  //   expect(disposes).toBe(0);
  //   store.defs.GetValue.use(client).refetch();
  //   await delay(15);
  //   expect(runs).toBe(2);
  //   await delay(15);
  //   expect(disposes).toBe(1);
  // });

  // test("reactive query #1", async () => {
  //   const client = createClient();
  //   const store = baseStore
  //     .use("Value", ({ atom }) => atom(1))
  //     .use("GetValue", ({ query }, { Value }) =>
  //       query<GetValueVariables, GetValueData>({
  //         // query field can be atom, once atom changed, the query re-fetches
  //         resolve: { value: Value },
  //       })
  //     );

  //   const v1 = await store.defs.GetValue.use(client).get();
  //   store.defs.Value.use(client).set({ data: 2 });
  //   // wait for change notification
  //   await delay();
  //   const v2 = await store.defs.GetValue.use(client).get();

  //   expect(v1).toEqual({ value: 1 });
  //   expect(v2).toEqual({ value: 2 });
  // });

  // test("reactive query #2", async () => {
  //   const client = createClient();
  //   const store = baseStore
  //     .use("Factor", ({ atom }) => atom(1))
  //     .use("GetValue", ({ query }) =>
  //       query<GetValueVariables, GetValueData>({
  //         resolve: { value: (args: GetValueVariables) => args.value },
  //       })
  //     )
  //     .use("GetSum", ({ query }, { Factor, GetValue }) =>
  //       query<void, { sum: Number }>({
  //         resolve: {
  //           sum: async (_, { get }) => {
  //             const v1 = await get(GetValue, { variables: { value: 2 } });
  //             const v2 = await get(GetValue, { variables: { value: 3 } });
  //             const v3 = get(Factor);
  //             return (v1.value + v2.value) * v3;
  //           },
  //         },
  //       })
  //     );

  //   const r1 = await store.defs.GetSum.use(client).get();
  //   // update value 2 to 4
  //   store.defs.GetValue.use(client).set({
  //     variables: { value: 2 },
  //     data: { value: 4 },
  //   });
  //   store.defs.GetValue.use(client).set({
  //     variables: { value: 3 },
  //     data: { value: 6 },
  //   });

  //   // wait for refetching affected
  //   await delay();
  //   const r2 = await store.defs.GetSum.use(client).get();
  //   // try to change atom, the query should refetch as well
  //   store.defs.Factor.use(client).set({ data: 2 });
  //   // wait for refetching affected
  //   await delay();
  //   const r3 = await store.defs.GetSum.use(client).get();

  //   expect(r1.sum).toBe(5);
  //   expect(r2.sum).toBe(10);
  //   expect(r3.sum).toBe(20);
  // });
});
