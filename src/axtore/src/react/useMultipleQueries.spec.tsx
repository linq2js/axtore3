import { Optional, gql } from "../types";
import React, { Suspense } from "react";
import { createClient, createWrapper, enableAsyncTesting } from "../testUtils";

import { createStore } from "../createStore";
import { delay } from "../util";
import { render } from "@testing-library/react";
import { useMultipleQueries } from "./useMultipleQueries";

const STORE_GQL = gql`
  query GetValue($value: Int, $factor: Float) {
    value(value: $value, factor: $factor)
  }
`;

const baseStore = createStore(STORE_GQL);

type GetValueVariables = { value: number; factor: number };
type GetValueData = { value: number };

enableAsyncTesting();

describe("multiple queries", () => {
  test("all done", async () => {
    const client = createClient({
      mock: [({ value, factor }) => ({ value: value * factor })],
      delay: 5,
    });
    const store = baseStore
      .use("GetValue1:GetValue", ({ query }) =>
        query<Optional<GetValueVariables, "value">, GetValueData>({
          variables: { value: 1 },
        })
      )
      .use("GetValue2:GetValue", ({ query }) =>
        query<Optional<GetValueVariables, "value">, GetValueData>({
          variables: { value: 2 },
        })
      );

    const Wrapper = createWrapper(client);

    const App = () => {
      const data = useMultipleQueries(
        { q1: store.defs.GetValue1, q2: store.defs.GetValue2 },
        {
          q1: { variables: { factor: 2 } },
          q2: { variables: { factor: 4 } },
        }
      );
      return <div data-testid="result">{data.q1.value + data.q2.value}</div>;
    };

    const { getByTestId } = render(
      <Wrapper>
        <Suspense fallback={<div data-testid="loading" />}>
          <App />
        </Suspense>
      </Wrapper>
    );

    getByTestId("loading");
    await delay(10);
    expect(getByTestId("result").innerHTML).toBe("10");
  });
});
