import {
  cleanFetchMocking,
  createClient,
  registerFetchMocking,
} from "../testUtils";
import { from, gql } from "@apollo/client";

import { RestLink } from "./RestLink";
import { createStore } from "../createStore";

const BASE_URL = "/api";

type GetValueData = { getValue: { result: string } };

type PostValueArgs = { value: number };
type PostValueData = { postValue: { result: string } };

cleanFetchMocking();

const STORE_GQL = gql`
  query GetValue {
    getValue @client {
      result
    }
  }

  mutation PostValue($value: Int) {
    postValue(value: $value) @client {
      result
    }
  }

  query GetValue1 {
    getValue1 @client {
      result
    }
  }

  query GetValue2 {
    getValue2 @client {
      result
    }
  }

  query GetValue3 {
    getValue3 @client {
      result
    }
  }
`;
const baseStore = createStore(STORE_GQL);

describe("query", () => {
  test("GET", async () => {
    // arrange
    const client = createClient({
      rest: { baseUrl: BASE_URL },
      mock: [(_, url) => ({ result: url })],
    });

    const store = baseStore.use("GetValue", ({ query, rest }) =>
      query<void, GetValueData>({
        resolve: { getValue: rest("get", "/value") },
      })
    );

    // act
    const result = await store.defs.GetValue.use(client).get();

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

    const store = baseStore.use("PostValue", ({ mutation, rest }) =>
      mutation<PostValueArgs, PostValueData>({
        resolve: {
          postValue: rest("post", (body) => ({ path: "/value", body })),
        },
      })
    );

    // act
    const r1 = await store.defs.PostValue.use(client).call({
      variables: { value: 1 },
    });
    const r2 = await store.defs.PostValue.use(client).call({
      variables: { value: 2 },
    });

    // assert
    expect(r1).toEqual({ postValue: { result: 1 } });
    expect(r2).toEqual({ postValue: { result: 2 } });
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
    const store = baseStore
      .use("GetValue1", ({ query, rest }) =>
        query<void, { getValue1: { result: string } }>({
          resolve: { getValue1: rest("get", "/value", { type: "v1" }) },
        })
      )
      .use("GetValue2", ({ query, rest }) =>
        query<void, { getValue2: { result: string } }>({
          resolve: { getValue2: rest("get", "/value", { type: "v2" }) },
        })
      )
      .use("GetValue3", ({ query, rest }) =>
        query<void, { getValue3: { result: string } }>({
          resolve: { getValue3: rest("get", "/value") },
        })
      );

    // act
    const [r1, r2, r3] = await Promise.all([
      store.defs.GetValue1.use(client).get(),
      store.defs.GetValue2.use(client).get(),
      store.defs.GetValue3.use(client).get(),
    ]);

    // assert
    expect(r1).toEqual({ getValue1: { result: "v1" } });
    expect(r2).toEqual({ getValue2: { result: "v2" } });
    expect(r3).toEqual({ getValue3: { result: "unknown" } });
  });
});
