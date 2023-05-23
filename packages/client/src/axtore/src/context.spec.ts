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
});
