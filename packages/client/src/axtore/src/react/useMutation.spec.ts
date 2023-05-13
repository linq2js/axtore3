import { createClient, createWrapper, enableAsyncTesting } from "../test";

import { createMutation } from "../createMutation";
import { delay } from "../util";
import { gql } from "../types";
import { renderHook } from "@testing-library/react-hooks";
import { useMutation } from "./useMutation";

const DOC = gql`
  mutation Update($value: Int) {
    update(value: $value) {
      result
    }
  }
`;

const Update = createMutation<{ value: number }, { result: number }>(DOC, {
  operation: "Update",
});

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
      return useMutation(Update);
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
