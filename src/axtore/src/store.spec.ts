import { create } from ".";

describe("store", () => {
  test("empty document store", () => {
    const store = create();

    expect(store.defs).toEqual({});
  });
});
