import { createModel, patchLocalFields } from "./createModel";
import { cleanFetchMocking, createClient } from "./test";
import { untilSubscriptionNotifyingDone, gql } from "./util";

cleanFetchMocking();

describe("query", () => {
  test("field mapping", async () => {
    const client = createClient();
    const model = createModel()
      .type("Todo", {
        title: [
          "Title",
          (_, args) => {
            return { short: args.short, long: args.long };
          },
        ],
      })
      .query("count", () => 1)
      .query("todo", () => ({ id: 1 }), { type: "Todo" })
      .query(
        "xcount",
        // the type patching should handle count, todo, title resolvers
        gql<void, { count: number; otherCount: number }>`
          query {
            count
            todo {
              title(short: "SHORT", long: "LONG")
            }
            otherCount: count
          }
        `
      );
    const data = await model.call(client, (x) => x.$xcount());
    expect(data).toEqual({
      count: 1,
      otherCount: 1,
      todo: {
        __typename: "Todo",
        title: { __typename: "Title", short: "SHORT", long: "LONG" },
      },
    });
  });

  test("simple dynamic query", async () => {
    const client = createClient();
    const model = createModel().query("count", (_: void) => 1);
    const data = await model.call(client, ({ $count }) => $count());
    expect(data).toEqual({ count: 1 });
  });

  test("query with args", async () => {
    const client = createClient();
    const model = createModel().query(
      "sum",
      (args: { a: number; b: number }) => args.a + args.b
    );
    const data = await model.call(client, ({ $sum }) => $sum({ a: 1, b: 2 }));
    expect(data).toEqual({ sum: 3 });
  });

  test("server query", async () => {
    const COUNT_QUERY = gql<void, { count: number }>`
      query {
        count
      }
    `;
    const client = createClient({ mock: [() => ({ count: 1 })] });
    const model = createModel().query("count", COUNT_QUERY);
    const data = await model.call(client, ({ $count }) => $count());
    expect(data).toEqual({ count: 1 });
  });

  test("refresh client query", async () => {
    const client = createClient();
    const dataList = [1, 2];
    const model = createModel().query("count", () => dataList.shift());
    const d1 = await model.call(client, ({ $count }) => $count());
    const d2 = await model.call(client, ({ $count }) => $count());
    const d3 = await model.call(client, (x) => x.$count.refetch());

    expect(d1).toEqual({ count: 1 });
    expect(d2).toEqual({ count: 1 });
    expect(d3).toEqual({ count: 2 });
  });

  test("derived query", async () => {
    let calls = 0;
    const client = createClient();
    const dataList = [1, 2, 3];
    const model = createModel()
      .query("count", () => dataList.shift() ?? 0)
      .query("doubledCount", async (_: void, { $count }) => {
        calls++;
        const { count } = await $count();
        return count * 2;
      });
    const d1 = await model.call(client, ({ $doubledCount }) => $doubledCount());
    await model.call(client, ({ $count }) => $count.refetch());
    await untilSubscriptionNotifyingDone();
    const d2 = await model.call(client, ({ $doubledCount }) => $doubledCount());
    await model.call(client, ({ $count }) => $count.refetch());
    await untilSubscriptionNotifyingDone();
    const d3 = await model.call(client, ({ $doubledCount }) => $doubledCount());
    expect(d1).toEqual({ doubledCount: 2 });
    expect(d2).toEqual({ doubledCount: 4 });
    expect(d3).toEqual({ doubledCount: 6 });
    expect(calls).toBe(3);
  });

  test("multiple dynamic queries", async () => {
    const client = createClient();
    const model = createModel()
      .query("value1", (_: void) => 1)
      .query("value2", (_: void) => 2)
      .query(
        "sum",
        async (_: void, { $value1, $value2 }) =>
          (await $value1()).value1 + (await $value2()).value2
      );

    const data = await model.call(client, ({ $sum }) => $sum());
    expect(data).toEqual({ sum: 3 });
  });

  test("update query with plain object", async () => {
    const client = createClient();
    const model = createModel().query("count", (args: void) => 1);
    const d1 = await model.call(client, ({ $count }) => $count());
    const d2 = await model.call(client, async ({ $count }) => {
      await $count.set({ count: 2 });
      return $count();
    });

    const d3 = await model.call(client, ({ $count }) => $count());

    expect(d1).toEqual({ count: 1 });
    expect(d2).toEqual({ count: 2 });
    expect(d3).toEqual({ count: 2 });
  });

  test("update query with recipe", async () => {
    const client = createClient();
    const model = createModel().query("count", (args: void) => 1);
    const d1 = await model.call(client, ({ $count }) => $count());
    const d2 = await model.call(client, async ({ $count }) => {
      $count.set((prev) => {
        prev.count++;
      });
      await untilSubscriptionNotifyingDone();
      return $count();
    });

    expect(d1).toEqual({ count: 1 });
    expect(d2).toEqual({ count: 2 });
  });
});

describe("model", () => {
  const baseModel = createModel().query("count", () => 1);

  test("use #1", async () => {
    const client = createClient();
    const model = baseModel
      .use(baseModel.meta)
      .query("doubledCount", async (_: void, { $count }) => {
        const { count } = await $count();
        return count * 2;
      });

    const data = await model.call(client, ({ $doubledCount }) =>
      $doubledCount()
    );

    expect(data).toEqual({ doubledCount: 2 });
  });

  test("use #2", async () => {
    const client = createClient();
    const otherModel = createModel().query("factor", () => 2);
    const model = baseModel
      .use({ ...baseModel.meta, ...otherModel.meta })
      .query("doubledCount", async (_: void, { $count, $factor }) => {
        const [{ count }, { factor }] = await Promise.all([
          $count(),
          $factor(),
        ]);

        return count * factor;
      });

    const data = await model.call(client, ({ $doubledCount }) =>
      $doubledCount()
    );

    expect(data).toEqual({ doubledCount: 2 });
  });
});

describe("type", () => {
  test("type patching", async () => {
    const client = createClient();
    const todos = [
      { id: 1, title: "Todo 1" },
      { id: 2, title: "Todo 2" },
    ];
    const model = createModel()
      .query("todo", () => todos[0], { type: "Todo" })
      .query("todos", () => todos, { type: "Todo" });

    const data = await model.call(client, async (x) => ({
      ...(await x.$todo()),
      ...(await x.$todos()),
    }));

    expect(data).toEqual({
      todo: { ...todos[0], __typename: "Todo" },
      todos: todos.map((x) => ({ ...x, __typename: "Todo" })),
    });

    expect(data.todo).not.toBe(todos[0]);
    expect(data.todos).not.toBe(todos);
  });

  test("type resolving", async () => {
    const client = createClient();
    const otherModel = createModel().type("Todo", { extra: () => 1 });
    const model = createModel()
      // copy type resolvers from other model
      .use(otherModel.meta)
      .type("Todo", {
        description: () => "Todo description",
      })
      .query("todo", () => ({ id: 1, title: "Todo" }), { type: "Todo" })
      .query(
        "todoDetails",
        gql`
          query {
            todo @client {
              id
              title
              description @client
              extra @client
            }
          }
        `
      );

    const data = await model.call(client, (x) => x.$todoDetails());

    expect(data).toEqual({
      todo: {
        __typename: "Todo",
        id: 1,
        title: "Todo",
        extra: 1,
        description: "Todo description",
      },
    });
  });
});

describe("effect", () => {
  test("handle query change", async () => {
    let changes = 0;
    const client = createClient();
    const model = createModel()
      .query("count", (args: void) => 1)
      .effect(({ $count }) => {
        $count.on({ change: () => changes++ });
      });

    await model.call(client, async ({ $count }) => {
      await $count.set({ count: 2 });
      await $count.set({ count: 3 });
      await $count.set({ count: 4 });
    });

    const data = await model.call(client, ({ $count }) => $count());
    expect(changes).toBe(3);
    expect(data).toEqual({ count: 4 });
  });
});

describe("state", () => {
  test("simple value", () => {
    const client = createClient();
    const model = createModel().state("count", 1);
    const data = model.call(client, (x) => x.$count());
    expect(data).toBe(1);
  });

  test("derived state", () => {
    const client = createClient();
    const model = createModel()
      .state("a", 1, { name: "a" })
      .state("b", (x) => x.$a() * 2, { name: "b" })
      .state("c", ({ $b }) => $b() * 2, { name: "c" })
      .state("d", (x) => x.$a() * 3, { name: "d" });
    const d1 = model.call(client, (x) => x.$b());
    const d2 = model.call(client, (x) => x.$c());
    const d3 = model.call(client, (x) => x.$d());
    model.call(client, (x) => x.$a(2));
    const d4 = model.call(client, (x) => x.$b());
    const d5 = model.call(client, (x) => x.$c());
    const d6 = model.call(client, (x) => x.$d());
    expect(d1).toBe(2);
    expect(d2).toBe(4);
    expect(d3).toBe(3);
    expect(d4).toBe(4);
    expect(d5).toBe(8);
    expect(d6).toBe(6);
  });
});

describe("compound testing", () => {
  test("counter", async () => {
    const client = createClient();
    const counterModel = createModel()
      .state("count", 1)
      .mutation("increment", (args: void, { $count }) => {
        $count((prev) => prev + 1);
      });

    // `client` is ApolloClient object
    const d1 = counterModel.call(client, (x) => x.$count());
    await counterModel.call(client, (x) => x.$increment());
    const d2 = counterModel.call(client, (x) => x.$count());
    expect(d1).toEqual(1);
    expect(d2).toEqual(2);
  });
});

describe("data", () => {
  test("data object must be persisted between mutation dispatches", async () => {
    const client = createClient();
    const model = createModel().mutation("increment", (_: void, { data }) => {
      data.count = (data.count ?? 0) + 1;
      return data.count as number;
    });
    const d1 = await model.call(client, (x) => x.$increment());
    const d2 = await model.call(client, (x) => x.$increment());
    const d3 = await model.call(client, (x) => x.$increment());

    expect(d1).toEqual({ increment: 1 });
    expect(d2).toEqual({ increment: 2 });
    expect(d3).toEqual({ increment: 3 });
  });
});
