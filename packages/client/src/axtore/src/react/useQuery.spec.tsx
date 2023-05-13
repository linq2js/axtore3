import React, { Suspense } from "react";
import { createClient, createWrapper, enableAsyncTesting } from "../test";

import { createQuery } from "../createQuery";
import { delay } from "../util";
import { gql } from "../types";
import { render } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import { useQuery } from "./useQuery";

const DOC = gql`
  query GetValue($value: Int) {
    getValue(value: $value)
  }
`;

type GetValueVariables = { value: number };
type GetValueData = { getValue: number };

const GetValue = createQuery<GetValueVariables, GetValueData>(DOC, {
  operation: "GetValue",
});

enableAsyncTesting();

describe("normal query", () => {
  test("loading status", async () => {
    // arrange
    const client = createClient({
      mock: [({ value }) => ({ getValue: value })],
      delay: 5,
    });
    const wrapper = createWrapper(client);
    const useTest = () => {
      const r = useQuery(GetValue, { variables: { value: 1 } });
      return r.loading ? null : r.data;
    };

    // act
    const { result } = renderHook(useTest, { wrapper });

    // assert
    expect(result.current).toBeNull();
    await delay(20);
    expect(result.current).toEqual({ getValue: 1 });
  });

  test("refetch", async () => {
    // arrange
    const factors = [1, 2];
    const client = createClient({
      mock: [({ value }) => ({ getValue: value * (factors.shift() ?? 0) })],
      delay: 5,
    });
    const wrapper = createWrapper(client);
    const useTest = () => {
      return useQuery(GetValue, { variables: { value: 1 } });
    };

    // act
    const { result } = renderHook(useTest, { wrapper });

    // assert
    await delay(20);
    expect(result.current.data).toEqual({ getValue: 1 });
    await result.current.refetch();
    await delay(20);
    expect(result.current.data).toEqual({ getValue: 2 });
  });
});

describe("suspense and error boundary", () => {
  test("suspense", async () => {
    const client = createClient({
      mock: [
        ({ value }) => {
          return { getValue: value };
        },
      ],
      delay: 5,
    });

    const Wrapper = createWrapper(client);
    const App = () => {
      const d = useQuery(GetValue, {
        variables: { value: 1 },
      }).wait();
      return <div data-testid="value">{d.getValue}</div>;
    };

    // act
    const { getByTestId } = render(
      <Wrapper>
        <Suspense fallback={<div data-testid="loading" />}>
          <App />
        </Suspense>
      </Wrapper>
    );

    // assert
    getByTestId("loading");
    await delay(10);
    expect(getByTestId("value").innerHTML).toBe("1");
  });
});
