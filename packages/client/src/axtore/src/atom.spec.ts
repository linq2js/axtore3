import { createAtom } from "./createAtom";
import { createClient } from "./test";
import equal from "@wry/equality";
import { gql } from "@apollo/client";

describe("static atom", () => {
  test("static atom", () => {
    const client = createClient();
    const Value = createAtom(1);
    const changed = jest.fn();

    const r1 = Value.use(client).get();

    Value.use(client).subscribe({ onChange: changed });
    Value.use(client).set({ data: 2 });
    const r2 = Value.use(client).get();

    expect(r1).toBe(1);
    expect(r2).toBe(2);
    expect(changed).toBeCalled();
  });

  test("custom equality", () => {
    const client = createClient();
    const Value = createAtom({ id: 1 }, { equal });
    const changed = jest.fn();

    const r1 = Value.use(client).get();
    Value.use(client).subscribe({ onChange: changed });
    // same object shape, but diff reference
    Value.use(client).set({ data: { id: 1 } });
    const r2 = Value.use(client).get();

    expect(r1).toBe(r2);
    expect(changed).not.toBeCalled();
  });

  test("mutate complex object", () => {
    const client = createClient();
    const Value = createAtom({
      name: "Bill",
      age: 1,
      children: [{ name: "unknown", school: {} }],
      company: { name: "Google" },
    });

    Value.use(client).set({
      data: (data) => {
        data.age = 100;
        data.children[0].name = "Mary";
        data.children.push({ name: "Tom", school: {} });
        data.company.name = "Microsoft";
      },
    });

    const r = Value.use(client).get();

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
    const Value = createAtom(1, { key: "myValue" });

    client.writeQuery({ query: VALUE_GQL, data: { myValue: 2 } });
    const r = Value.use(client).get();

    expect(r).toBe(2);
  });

  test("write value", () => {
    const VALUE_GQL = gql`
      query GetValue {
        myValue
      }
    `;
    const client = createClient();
    const Value = createAtom(1, { key: "myValue" });

    Value.use(client).set({ data: (prev) => prev + 1 });

    const r = client.readQuery({ query: VALUE_GQL });

    expect(r).toEqual({ myValue: 2 });
  });
});

describe("computed atom", () => {
  test("computed atom", () => {
    const client = createClient();
    const V1 = createAtom(1);
    const V2 = createAtom(2);
    const Sum = createAtom(({ get }) => get(V1) + get(V2));

    const r1 = Sum.use(client).get();
    V2.use(client).set({ data: 3 });
    const r2 = Sum.use(client).get();

    expect(r1).toBe(3);
    expect(r2).toBe(4);
  });
});
