import { createModel } from "../createModel";
import { createClient, createWrapper, enableAsyncTesting } from "../test";
import { createHooks } from "./createHooks";
import { waitAll } from "./waitAll";
import { act, renderHook } from "@testing-library/react";
import { delay } from "../util";

enableAsyncTesting();

test("without error", async () => {
  const client = createClient();
  const model = createModel()
    .query("data1", async ({ delay }) => {
      await delay(10);
      return 1;
    })
    .query("data2", async ({ delay }) => {
      await delay(5);
      return 2;
    });
  let error;
  let loading = false;
  const { useData1, useData2 } = createHooks(model.meta);
  const wrapper = createWrapper(client, {
    onError: (e) => (error = e),
    onSuspense: () => (loading = true),
  });
  const { result } = renderHook(() => waitAll(useData1(), useData2()), {
    wrapper,
  });

  expect(loading).toBeTruthy();
  await delay(20);
  expect(result.current).toEqual([{ data1: 1 }, { data2: 2 }]);
});

test("with error", async () => {
  const client = createClient();
  const model = createModel()
    .query("data1", async ({ delay }) => {
      await delay(5);
      throw new Error("ERROR");
    })
    .query("data2", async ({ delay }) => {
      await delay(10);
      return 2;
    });
  let error: Error | undefined;
  let loading = false;
  const { useData1, useData2 } = createHooks(model.meta);
  const wrapper = createWrapper(client, {
    onError: (e) => (error = e),
    onSuspense: () => (loading = true),
  });
  renderHook(() => waitAll(useData1(), useData2()), {
    wrapper,
  });

  expect(loading).toBeTruthy();
  await act(() => delay(20));
  expect(error?.message).toBe("ERROR");
});
