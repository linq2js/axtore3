import { createClient } from "./testUtils";
import { createStore } from "./createStore";
import equal from "@wry/equality";
import { gql } from "@apollo/client";

const baseStore = createStore();

describe("static atom", () => {
  test("static atom", () => {
    const client = createClient();
    const store = baseStore.use("Value", ({ atom }) => atom(1));
    const changed = jest.fn();

    const r1 = store.defs.Value.use(client).get();

    store.defs.Value.use(client).subscribe({ onChange: changed });
    store.defs.Value.use(client).set({ data: 2 });
    const r2 = store.defs.Value.use(client).get();

    expect(r1).toBe(1);
    expect(r2).toBe(2);
    expect(changed).toBeCalled();
  });

  test("custom equality", () => {
    const client = createClient();
    const store = baseStore.use("Value", ({ atom }) =>
      atom({ id: 1 }, { equal })
    );
    const changed = jest.fn();

    const r1 = store.defs.Value.use(client).get();
    store.defs.Value.use(client).subscribe({ onChange: changed });
    // same object shape, but diff reference
    store.defs.Value.use(client).set({ data: { id: 1 } });
    const r2 = store.defs.Value.use(client).get();

    expect(r1).toBe(r2);
    expect(changed).not.toBeCalled();
  });

  test("mutate complex object", () => {
    const client = createClient();
    const store = baseStore.use("Value", ({ atom }) =>
      atom({
        name: "Bill",
        age: 1,
        children: [{ name: "unknown", school: {} }],
        company: { name: "Google" },
      })
    );

    store.defs.Value.use(client).set({
      data: (data) => {
        data.age = 100;
        data.children[0].name = "Mary";
        data.children.push({ name: "Tom", school: {} });
        data.company.name = "Microsoft";
      },
    });

    const r = store.defs.Value.use(client).get();

    expect(r).toEqual({
      name: "Bill",
      age: 100,
      children: [
        { name: "Mary", school: {} },
        { name: "Tom", school: {} },
      ],
      company: { name: "Microsoft" },
    });
  });
});

describe("persistence", () => {
  test("read value", () => {
    const VALUE_GQL = gql`
      query GetValue {
        myValue
      }
    `;
    const client = createClient();
    const store = baseStore.use("Value", ({ atom }) =>
      atom(1, { key: "myValue" })
    );

    client.writeQuery({ query: VALUE_GQL, data: { myValue: 2 } });
    const r = store.defs.Value.use(client).get();

    expect(r).toBe(2);
  });

  test("write value", () => {
    const VALUE_GQL = gql`
      query GetValue {
        myValue
      }
    `;
    const client = createClient();
    const store = baseStore.use("Value", ({ atom }) =>
      atom(1, { key: "myValue" })
    );

    store.defs.Value.use(client).set({ data: (prev) => prev + 1 });

    const r = client.readQuery({ query: VALUE_GQL });

    expect(r).toEqual({ myValue: 2 });
  });
});

describe("dynamic atom", () => {
  test("dynamic atom", () => {
    const client = createClient();
    const store = baseStore
      .use("V1", ({ atom }) => atom(1))
      .use("V2", ({ atom }) => atom(2))
      .use("Sum", ({ atom }, { V1, V2 }) =>
        atom(({ get }) => get(V1) + get(V2))
      );

    const r1 = store.defs.Sum.use(client).get();
    store.defs.V2.use(client).set({ data: 3 });
    const r2 = store.defs.Sum.use(client).get();

    expect(r1).toBe(3);
    expect(r2).toBe(4);
  });
});
