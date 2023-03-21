import { createClient, createWrapper, enableAsyncTesting } from "../testUtils";

import { createStore } from "../createStore";
import { delay } from "../util";
import { gql } from "../types";
import { renderHook } from "@testing-library/react-hooks";
import { useMutation } from "./useMutation";

const STORE_GQL = gql`
  mutation Update($value: Int) {
    update(value: $value) {
      result
    }
  }
`;

const baseStore = createStore(STORE_GQL).use("Update", ({ mutation }) =>
  mutation<{ value: number }, { result: number }>()
);

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
      return useMutation(baseStore.defs.Update, {
        variables: { value: 1 },
      });
    };

    // act
    const { result } = renderHook(useTest, { wrapper });

    // assert
    expect(result.current.data).toBeUndefined();
    result.current.mutate();
    await delay(20);
    expect(result.current.data).toEqual({ update: { result: 1 } });
  });
});
