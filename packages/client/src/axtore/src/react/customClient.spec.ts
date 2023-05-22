import { act, renderHook } from "@testing-library/react";
import { createModel } from "../createModel";
import { nextUpdate } from "../util";
import { useMemo } from "react";
import { createHooks } from "./createHooks";
import { createClient } from "../test";
import { createUseModel } from "./createUseModel";

const model = createModel()
  .state("count", 1)
  .mutation("increment", ({ $count }) => {
    $count((prev) => prev + 1);
  });

const useCounterModel = createUseModel(model.meta, { createClient });

describe("custom client", () => {
  test("local client", async () => {
    const { result } = renderHook(() => {
      const { useCount, useIncrement } = useMemo(
        () => createHooks(model.meta, { client: createClient() }),
        []
      );

      return {
        count: useCount(),
        increment: useIncrement(),
      };
    });

    expect(result.current.count).toBe(1);
    await act(async () => {
      result.current.increment();
      await act(nextUpdate);
    });

    expect(result.current.count).toBe(2);
    await act(async () => {
      result.current.increment();
      await act(nextUpdate);
    });
    await act(nextUpdate);
    expect(result.current.count).toBe(3);
  });

  test("useModel", async () => {
    const { result } = renderHook(() => {
      const { useCount, useIncrement } = useCounterModel();

      return {
        count: useCount(),
        increment: useIncrement(),
      };
    });

    expect(result.current.count).toBe(1);
    await act(async () => {
      result.current.increment();
      await act(nextUpdate);
    });

    expect(result.current.count).toBe(2);
    await act(async () => {
      result.current.increment();
      await act(nextUpdate);
    });
    await act(nextUpdate);
    expect(result.current.count).toBe(3);
  });

  test("static client", async () => {
    const { useCount, useIncrement } = createHooks(model.meta, {
      client: createClient(),
    });

    const { result } = renderHook(() => {
      return {
        count: useCount(),
        increment: useIncrement(),
      };
    });

    expect(result.current.count).toBe(1);
    await act(async () => {
      result.current.increment();
      await act(nextUpdate);
    });

    expect(result.current.count).toBe(2);
    await act(async () => {
      result.current.increment();
      await act(nextUpdate);
    });
    await act(nextUpdate);
    expect(result.current.count).toBe(3);
  });
});
