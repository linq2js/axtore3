import { isAtom, isFunction, isMutation, isQuery } from "../util";

import { useAtom as atomHook } from "./useAtom";
import { useMultipleQueries as multipleQueriesHook } from "./useMultipleQueries";
import { useMutationCallback as mutationCallbackHook } from "./useMutationCallback";
import { useMutation as mutationHook } from "./useMutation";
import { useQuery as queryHook } from "./useQuery";

export type Use = typeof atomHook &
  typeof mutationHook &
  typeof queryHook &
  typeof multipleQueriesHook &
  typeof mutationCallbackHook;

const use: Use = (input: any, options?: any): any => {
  if (isFunction(input)) {
    return mutationCallbackHook(input);
  }

  if (isAtom(input)) {
    return atomHook(input);
  }

  if (isQuery(input)) {
    return queryHook(input, options);
  }

  if (isMutation(input)) {
    return mutationHook(input, options);
  }

  return multipleQueriesHook(input, options);
};

export { use };
