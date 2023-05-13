import { isAtom, isFunction, isLoadable, isMutation, isQuery } from "../util";

import { useAtom as atomHook } from "./useAtom";
import { useLoadable as loadableHook } from "./useLoadable";
import { useMultipleLoadables as multipleLoadablesHook } from "./useMultipleLoadables";
import { useMutationCallback as mutationCallbackHook } from "./useMutationCallback";
import { useMutation as mutationHook } from "./useMutation";
import { useQuery as queryHook } from "./useQuery";

export { useStable } from "./useStable";

export type Use = typeof atomHook &
  typeof mutationHook &
  typeof queryHook &
  typeof multipleLoadablesHook &
  typeof mutationCallbackHook &
  typeof loadableHook;

const use: Use = (input: any, options?: any): any => {
  if (isLoadable(input)) {
    return loadableHook(input);
  }

  if (isFunction(input)) {
    return mutationCallbackHook(input);
  }

  if (isAtom(input)) {
    return atomHook(input);
  }

  if (isQuery(input)) {
    return queryHook(input as any, options);
  }

  if (isMutation(input)) {
    return mutationHook(input, options);
  }

  return multipleLoadablesHook(input, options);
};

export { use };
