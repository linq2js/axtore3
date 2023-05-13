import { Optional, gql } from "./types";
import { cleanFetchMocking, createClient } from "./test";

import { createAtom } from "./createAtom";
import { createQuery } from "./createQuery";
import { delay } from "./util";

const DOC = gql`
  query NoVariables {
    noVariables
  }

  query Double($value: Float) {
    double(value: $value)
  }

  query GetValue($value: Int) {
    value(value: $value)
  }
`;

cleanFetchMocking();

describe("static query", () => {
  test("no variables", async () => {
    let serverHits = 0;
    const data = Math.random();
    const client = createClient({
      rest: true,
      mock: [
        () => {
          serverHits++;
          return { noVariables: data };
        },
      ],
    });

    const q = createQuery<void, { noVariables: number }>(DOC, {
      operation: "NoVariables",
    });

    const r1 = await q.use(client).get();
    const r2 = await q.use(client).get();

    expect(r1).toEqual({ noVariables: data });
    expect(r2).toEqual({ noVariables: data });
    expect(serverHits).toBe(1);
  });

  test("with variables", async () => {
    let serverHits = 0;
    const client = createClient({
      rest: true,
      mock: [
        ({ value }) => {
          serverHits++;
          return { double: value * 2 };
        },
      ],
    });

    const q = createQuery<{ value: number }, { double: number }>(DOC, {
      operation: "Double",
    });

    const r1 = await q.use(client).get({ variables: { value: 1 } });
    const r2 = await q.use(client).get({ variables: { value: 1 } });
    const r3 = await q.use(client).get({ variables: { value: 2 } });
    const r4 = await q.use(client).get({ variables: { value: 2 } });

    expect(r1).toEqual({ double: 2 });
    expect(r2).toEqual({ double: 2 });
    expect(r3).toEqual({ double: 4 });
    expect(r4).toEqual({ double: 4 });
    expect(serverHits).toBe(2);
  });

  test("refetch", async () => {
    type Variables = { input: number };

    let count = 0;
    const client = createClient({
      mock: [
        ({ input }, operation) => {
          return { [operation]: `${operation}:${++count}:${input}` };
        },
      ],
    });

    const q1 = createQuery<Variables>(gql`
      query Query1($input: Int) {
        Query1(input: $input)
      }
    `);

    const q2 = createQuery<Variables>(gql`
      query Query2($input: Int) {
        Query2(input: $input)
      }
    `);

    const r1 = await q1.use(client).get({ variables: { input: 1 } });
    // call query1 with diff variables
    const r2 = await q1.use(client).get({ variables: { input: 2 } });

    const r3 = await q2.use(client).get({ variables: { input: 1 } });
    const r4 = await q2.use(client).get({ variables: { input: 2 } });

    await q1.use(client).refetch({ variables: { input: 1 } });
    const r5 = await q1.use(client).get({ variables: { input: 1 } });
    const r6 = await q1.use(client).get({ variables: { input: 2 } });

    expect(r1).toEqual({ Query1: "Query1:1:1" });
    expect(r2).toEqual({ Query1: "Query1:2:2" });
    expect(r3).toEqual({ Query2: "Query2:3:1" });
    expect(r4).toEqual({ Query2: "Query2:4:2" });
    expect(r5).toEqual({ Query1: "Query1:5:1" });
    // the result of query (Query1 {input: 2}) must be not changed
    expect(r6).toEqual({ Query1: "Query1:2:2" });
  });

  test("dynamic variables #1", async () => {
    let count = 0;
    const client = createClient({
      mock: [
        ({ a, b }) => {
          count++;
          return { sum: a + b };
        },
      ],
    });
    const A = createAtom(1);
    const B = createAtom(2);
    const Sum = createQuery<
      Optional<{ a: number; b: number }, "a" | "b"> | undefined
    >(
      gql`
        query Sum($a: Int, $b: Int) {
          sum(a: $a, b: $b)
        }
      `,
      {
        variables({ get }) {
          return {
            a: get(A),
            b: get(B),
          };
        },
      }
    );

    const r1 = await Sum.use(client).get();
    A.use(client).set({ data: 3 });
    let r2: { sum: number } | undefined;
    // the Sum query should be re-fetched after its dependencies changed
    Sum.use(client).subscribe({
      onChange(data) {
        r2 = data;
      },
    });

    await delay(10);

    expect(r1).toEqual({ sum: 3 });
    expect(r2).toEqual({ sum: 5 });
  });

  test("dynamic variables #2", async () => {
    let count = 0;
    const client = createClient({
      mock: [
        ({ a, b }) => {
          count++;
          return { sum: a + b };
        },
      ],
    });
    const A = createAtom(1);
    const B = createAtom(2);
    const Sum = createQuery<
      Optional<{ a: number; b: number }, "a" | "b"> | undefined
    >(
      gql`
        query Sum($a: Int, $b: Int) {
          sum(a: $a, b: $b)
        }
      `,
      {
        variables: { a: A, b: B },
      }
    );

    const r1 = await Sum.use(client).get();
    A.use(client).set({ data: 3 });
    let r2: { sum: number } | undefined;
    // the Sum query should be re-fetched after its dependencies changed
    Sum.use(client).subscribe({
      onChange(data) {
        r2 = data;
      },
    });

    await delay(10);

    expect(r1).toEqual({ sum: 3 });
    expect(r2).toEqual({ sum: 5 });
  });

  test("mapping #1", async () => {
    const client = createClient({
      mock: [({ value = 2 }) => ({ value })],
    });
    const Value = createQuery<
      { value?: number } | undefined,
      { value: number }
    >(DOC, {
      operation: "GetValue",
    });
    const Doubled = Value.wrap("doubled", { map: (x) => x.value * 2 });
    const AddOne = Doubled.wrap("addOne", { map: (x) => x.doubled + 1 });

    // without vars
    const r1 = await AddOne.use(client).get();
    // with vars
    const r2 = await AddOne.use(client).get({ variables: { value: 3 } });

    expect(r1).toEqual({ addOne: 5 });
    expect(r2).toEqual({ addOne: 7 });
  });

  test("mapping #2", async () => {
    let invalidateCount = 0;
    const client = createClient({
      mock: [({ value = 2 }) => ({ value })],
    });
    const Value = createQuery<
      { value?: number } | undefined,
      { value: number }
    >(DOC, {
      operation: "GetValue",
    });
    const Factor = createAtom(1);
    const MultiplyWithFactor = Value.wrap("result", {
      cache: true,
      map: (x, { get }) => {
        invalidateCount++;
        return x.value * get(Factor);
      },
    });

    const r1 = await MultiplyWithFactor.use(client).get();
    Factor.use(client).set({ data: 2 });
    await delay(10);
    const r2 = await MultiplyWithFactor.use(client).get();
    expect(invalidateCount).toBe(2);
    expect(r1).toEqual({ result: 2 });
    expect(r2).toEqual({ result: 4 });
  });
});
