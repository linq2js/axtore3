import { cleanFetchMocking, createClient } from "./test";

import { createQuery } from "./createQuery";
import { gql } from "./types";

const DOC = gql`
  query NoVariables {
    noVariables
  }

  query Double($value: Float) {
    double(value: $value)
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
});
