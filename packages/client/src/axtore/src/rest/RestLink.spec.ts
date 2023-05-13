import { cleanFetchMocking, createClient, registerFetchMocking } from "../test";

import { RestLink } from "./RestLink";
import { createMutation } from "../createMutation";
import { createQuery } from "../createQuery";
import { from } from "@apollo/client";
import { rest } from ".";

const BASE_URL = "/api";

type PostValueArgs = { value: number };
type PostValueData = { postValue: { result: string } };

cleanFetchMocking();

describe("query", () => {
  test("GET", async () => {
    // arrange
    const client = createClient({
      rest: { baseUrl: BASE_URL },
      mock: [(_, url) => ({ result: url })],
    });

    const GetValue = createQuery(
      "getValue",
      rest<void, { result: string }>("get", "/value")
    );

    // act
    const result = await GetValue.use(client).get();

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

    const PostValue = createMutation(
      "postValue",
      rest<PostValueArgs, PostValueData>("post", (body) => ({
        path: "/value",
        body,
      }))
    );

    // act
    const r1 = await PostValue.use(client).call({
      variables: { value: 1 },
    });
    const r2 = await PostValue.use(client).call({
      variables: { value: 2 },
    });

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
    const DoubledValue = createQuery(
      "doubledValue",
      rest<{ value: number }, { result: number }>(
        "post",
        "/doubledValue",
        (variables) => ({ body: variables })
      ).map((x) => x.result * 2)
    );

    const r1 = await DoubledValue.use(client).get({ variables: { value: 1 } });
    const r2 = await DoubledValue.use(client).get({ variables: { value: 2 } });

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
    const GetValue1 = createQuery(
      "getValue1",
      rest<void, { result: string }>("get", "/value", { type: "v1" })
    );
    const GetValue2 = createQuery(
      "getValue2",
      rest<void, { result: string }>("get", "/value", { type: "v2" })
    );
    const GetValue3 = createQuery(
      "getValue3",
      rest<void, { result: string }>("get", "/value")
    );

    // act
    const [r1, r2, r3] = await Promise.all([
      GetValue1.use(client).get(),
      GetValue2.use(client).get(),
      GetValue3.use(client).get(),
    ]);

    // assert
    expect(r1).toEqual({ getValue1: { result: "v1" } });
    expect(r2).toEqual({ getValue2: { result: "v2" } });
    expect(r3).toEqual({ getValue3: { result: "unknown" } });
  });
});
