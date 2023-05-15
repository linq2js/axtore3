import { createClient, createWrapper, enableAsyncTesting } from "../test";

import { delay, typed, gql } from "../util";
import { renderHook } from "@testing-library/react-hooks";
import { createModel } from "../createModel";
import { createHooks } from "./createHooks";

const DOC = gql`
  mutation Update($value: Int) {
    update(value: $value) {
      result
    }
  }
`;

const model = createModel().mutation(
  "update",
  typed<{ value: number }, { result: number }>(DOC)
);
const { useUpdate } = createHooks(model.meta);

enableAsyncTesting();

describe("normal mutation", () => {
  test("normal mutation", async () => {
    // arrange
    const client = createClient({
      mock: [
        ({ value }) => {
          return { update: { result: value } };
        },
      ],
    });
    const wrapper = createWrapper(client);
    const useTest = () => {
      return useUpdate();
    };

    // act
    const { result } = renderHook(useTest, { wrapper });

    // assert
    expect(result.current.data).toBeUndefined();
    result.current.mutate({ value: 1 });
    await delay(20);
    expect(result.current.data).toEqual({ update: { result: 1 } });
  });
});
