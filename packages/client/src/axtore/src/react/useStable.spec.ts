import { act, renderHook } from "@testing-library/react";

import { useStable } from "./useStable";

describe("useStable", () => {
  test("unstable callbacks must be memorized", () => {
    const c1 = jest.fn();
    const c2 = jest.fn();

    const { result, rerender } = renderHook(() =>
      useStable({
        c1: (...args: any[]) => c1(...args),
        c2: (...args: any[]) => c2(...args),
      })
    );
    const r1 = { ...result.current };
    rerender();
    const r2 = { ...result.current };
    expect(r1).toEqual(r2);

    r1.c1();
    r1.c2();

    expect(c1).toBeCalled();
    expect(c2).toBeCalled();
  });

  test("onInit", () => {
    const onInit = jest.fn();
    const { result, rerender } = renderHook(() => useStable({ onInit }));
    expect(onInit).toBeCalledTimes(1);
    rerender();
    rerender();
    expect(onInit).toBeCalledTimes(1);
  });

  test("state proxy", () => {
    let init = 1;
    const { result, rerender } = renderHook(() =>
      useStable({ count: init }, (state) => ({
        increment: () => state.count++,
      }))
    );

    expect(result.current.count).toBe(1);
    act(() => {
      result.current.increment();
    });
    expect(result.current.count).toBe(2);
    init = 3;
    // current state must be updated whenever initial state re-updated
    rerender();
    expect(result.current.count).toBe(3);
    act(() => {
      result.current.increment();
    });
    expect(result.current.count).toBe(4);
  });

  test("onMount and onUnmount", () => {
    const onMount = jest.fn();
    const onUnmount = jest.fn();
    const { rerender, unmount } = renderHook(() =>
      useStable({ onMount, onUnmount })
    );
    expect(onMount).toBeCalledTimes(1);
    rerender();
    rerender();
    expect(onMount).toBeCalledTimes(1);
    unmount();
    expect(onUnmount).toBeCalledTimes(1);
  });
});
