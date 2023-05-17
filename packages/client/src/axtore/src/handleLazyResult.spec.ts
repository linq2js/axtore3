import { createModel } from "./createModel";
import { createClient } from "./test";
import { delay } from "./util";

describe("query", () => {
  test("single update", async () => {
    let changed = false;
    const client = createClient();
    const values = [1, 2, 3];
    const model = createModel()
      .query("now", (args: void, { lazy, delay }) =>
        lazy(values.shift(), async () => {
          await delay(10);
          return values.shift();
        })
      )
      .effect(({ $now }) => {
        $now.on({
          change(r) {
            changed = true;
          },
        });
      });
    const d1 = await model.call(client, ({ $now }) => {
      return $now();
    });
    const d2 = await model.call(client, ({ $now }) => $now());
    await delay(30);
    const d3 = await model.call(client, ({ $now }) => {
      return $now();
    });
    expect(d1).toEqual({ now: 1 });
    expect(d2).toEqual({ now: 1 });
    expect(d3).toEqual({ now: 2 });
    expect(changed).toBeTruthy();
  });
});

describe("type", () => {});
