import React, { Suspense, useState } from "react";
import { createClient, createWrapper, enableAsyncTesting } from "../test";

import { delay, gql, typed } from "../util";
import { render } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import { createModel } from "../createModel";
import { createHooks } from "./createHooks";

const DOC = gql`
  query GetValue($value: Int) {
    getValue(value: $value)
  }
`;

type GetValueVariables = { value: number };
type GetValueData = { getValue: number };

const model = createModel().query(
  "getValue",
  typed<GetValueVariables, GetValueData>(DOC)
);
const { useGetValue } = createHooks(model.meta);

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
      const r = useGetValue({ variables: { value: 1 } });
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
      return useGetValue({ variables: { value: 1 } });
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

describe("dynamic query", () => {
  test("passing args", async () => {
    const client = createClient();
    const model = createModel().query(
      "doubledValue",
      (args: { value: number }) => args.value * 2
    );
    const { useDoubledValue } = createHooks(model.meta);
    const wrapper = createWrapper(client);
    const { result } = renderHook(
      () => {
        const [value, setValue] = useState(1);
        const { data } = useDoubledValue({ variables: { value } });
        return { data, setValue };
      },
      { wrapper }
    );
    await delay(10);
    expect(result.current.data).toEqual({ doubledValue: 2 });
    result.current.setValue(2);
    await delay(10);
    expect(result.current.data).toEqual({ doubledValue: 4 });
    const d1 = await model.call(client, (x) => x.$doubledValue({ value: 1 }));
    const d2 = await model.call(client, (x) => x.$doubledValue({ value: 2 }));
    expect(d1).toEqual({ doubledValue: 2 });
    expect(d2).toEqual({ doubledValue: 4 });
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
      const d = useGetValue({ variables: { value: 1 } }).wait();
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
