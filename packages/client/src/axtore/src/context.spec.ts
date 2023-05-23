import { createModel } from "./createModel";
import { createClient } from "./test";

describe("context", () => {
  test("query context", async () => {
    const client = createClient();
    const m1 = createModel({ context: { v1: 1 } }).query("q1", (x) => x.v1);
    const m2 = createModel({ context: { v2: 2 } }).query("q2", (x) => x.v2);
    const model = createModel().use({
      ...m1.meta,
      ...m2.meta,
    });

    const data = await model.call(client, async ({ $q1, $q2 }) => {
      const v1 = await $q1();
      const v2 = await $q2();
      return v1.q1 + v2.q2;
    });

    expect(data).toBe(3);
  });

  test("mutation context", async () => {
    const client = createClient();
    const m1 = createModel({ context: { v1: 1 } }).mutation("q1", (x) => x.v1);
    const m2 = createModel({ context: { v2: 2 } }).mutation("q2", (x) => x.v2);
    const model = createModel().use({
      ...m1.meta,
      ...m2.meta,
    });

    const data = await model.call(client, async ({ $q1, $q2 }) => {
      const v1 = await $q1();
      const v2 = await $q2();
      return v1.q1 + v2.q2;
    });

    expect(data).toBe(3);
  });

  test("state context", async () => {
    const client = createClient();
    const m1 = createModel({ context: { v1: 1 } }).state("q1", (x) => x.v1);
    const m2 = createModel({ context: { v2: 2 } }).state("q2", (x) => x.v2);
    const model = createModel().use({
      ...m1.meta,
      ...m2.meta,
    });

    const data = await model.call(
      client,
      async ({ $q1, $q2 }) => $q1() + $q2()
    );

    expect(data).toBe(3);
  });

  test("cross models", () => {
    const client = createClient();
    const m1 = createModel()
      .state("a", 1)
      .state("b", 3)
      .state("sum", ({ $a, $b }) => $a() + $b());
    const m2 = createModel().state("b", 2);
    const m3 = createModel()
      .use({
        ...m1.meta,
        ...m2.meta,
      })
      .state("sum", ({ $a, $b }) => $a() + $b());
    // expect $sum must be m1.$sum
    expect(m1.call(client, (x) => x.$sum())).toBe(4);
    // expect $sum must be m3.$sum
    expect(m3.call(client, (x) => x.$sum())).toBe(3);
  });

  test("derived model updating", async () => {
    const client = createClient();
    const m1 = createModel().query("count", () => 1);
    const m2 = m1.mutation("update", ({ $count }) => {
      $count.set({ count: 2 });
    });
    await m2.call(client, (x) => x.$update());
    const data = await m1.call(client, (x) => x.$count());
    expect(data).toEqual({ count: 2 });
  });
});
