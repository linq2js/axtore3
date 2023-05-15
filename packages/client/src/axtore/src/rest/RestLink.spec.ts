import { cleanFetchMocking, createClient, registerFetchMocking } from "../test";

import { RestLink } from "./RestLink";
import { from } from "@apollo/client";
import { rest } from ".";
import { createModel } from "../createModel";

const BASE_URL = "/api";

type PostValueArgs = { value: number };
type PostValueData = { postValue: { result: string } };

cleanFetchMocking();

const model = createModel()
  .query("getValue", rest<void, { result: string }>("get", "/value"))
  .query(
    "getValue1",
    rest<void, { result: string }>("get", "/value", { type: "v1" })
  )
  .query(
    "getValue2",
    rest<void, { result: string }>("get", "/value", { type: "v2" })
  )
  .query("getValue3", rest<void, { result: string }>("get", "/value"))
  .query(
    "doubledValue",
    rest<{ value: number }, { result: number }>(
      "post",
      "/doubledValue",
      (variables) => ({ body: variables })
    ).map((x) => x.result * 2)
  )
  .mutation(
    "postValue",
    rest<PostValueArgs, PostValueData>("post", (body) => ({
      path: "/value",
      body,
    }))
  );

describe("query", () => {
  test("GET", async () => {
    // arrange
    const client = createClient({
      rest: { baseUrl: BASE_URL },
      mock: [(_, url) => ({ result: url })],
    });

    // act
    const result = await model.call(client, (x) => x.$getValue());

    // assert
    expect(result).toEqual({ getValue: { result: `${BASE_URL}/value` } });
  });

  test("POST", async () => {
    // arrange
    const client = createClient({
      rest: { baseUrl: BASE_URL },
      mock: [
        // return value is the same as variables
        ({ value }) => ({ result: value }),
      ],
    });

    // act
    const r1 = await model.call(client, (x) => x.$postValue({ value: 1 }));
    const r2 = await model.call(client, (x) => x.$postValue({ value: 2 }));

    // assert
    expect(r1).toEqual({ postValue: { result: 1 } });
    expect(r2).toEqual({ postValue: { result: 2 } });
  });

  test("map", async () => {
    const client = createClient({
      rest: { baseUrl: BASE_URL },
      mock: [
        // return value is the same as variables
        ({ value }) => ({ result: value }),
      ],
    });

    const r1 = await model.call(client, (x) => x.$doubledValue({ value: 1 }));
    const r2 = await model.call(client, (x) => x.$doubledValue({ value: 2 }));

    expect(r1).toEqual({ doubledValue: 2 });
    expect(r2).toEqual({ doubledValue: 4 });
  });
});

describe("multiple endpoints", () => {
  test("multiple endpoints", async () => {
    registerFetchMocking({ rest: true }, [
      (_, u) => ({
        result: u.includes("v1") ? "v1" : u.includes("v2") ? "v2" : "unknown",
      }),
    ]);
    // arrange
    const fallback = new RestLink({ baseUrl: BASE_URL });
    const api1 = new RestLink({
      baseUrl: `${BASE_URL}/v1`,
      matcher: "v1",
    });
    const api2 = new RestLink({
      baseUrl: `${BASE_URL}/v2`,
      matcher: "v2",
    });
    const client = createClient({ link: from([api1, api2, fallback]) });
    // act
    const [r1, r2, r3] = await model.call(client, (x) =>
      Promise.all([x.$getValue1(), x.$getValue2(), x.$getValue3()])
    );

    // assert
    expect(r1).toEqual({ getValue1: { result: "v1" } });
    expect(r2).toEqual({ getValue2: { result: "v2" } });
    expect(r3).toEqual({ getValue3: { result: "unknown" } });
  });
});
