import React, { Suspense } from "react";
import { createClient, createWrapper, enableAsyncTesting } from "../test";
import { render, renderHook } from "@testing-library/react";

import { createLoadableSource } from "../createLoadableSource";
import { delay } from "../util";
import { useLoadable } from "./useLoadable";

enableAsyncTesting();

const GetValue = createLoadableSource(async () => {
  //   console.log(11);
  return 1;
});

beforeEach(() => {
  GetValue.invalidate();
});

describe("normal loadable", () => {
  test("loading status", async () => {
    // arrange
    const client = createClient();
    const wrapper = createWrapper(client);
    const useTest = () => {
      const r = useLoadable(GetValue);
      //   console.log(JSON.stringify(r));
      return r.loading ? null : r.data;
    };

    // act
    const { result } = renderHook(useTest, { wrapper });

    // assert
    expect(result.current).toBeNull();
    await delay(50);
    expect(result.current).toEqual(1);
  });
});

describe("suspense and error boundary", () => {
  test("suspense", async () => {
    const client = createClient();

    const Wrapper = createWrapper(client);
    const App = () => {
      const d = useLoadable(GetValue).wait();
      return <div data-testid="value">{d}</div>;
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
    await delay(50);
    expect(getByTestId("value").innerHTML).toBe("1");
  });
});
