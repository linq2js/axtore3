import { isAtom, isMutation, isQuery } from "../util";

import { useAtom as atomHook } from "./useAtom";
import { useMultipleQueries as multipleQueriesHook } from "./useMultipleQueries";
import { useMutation as mutationHook } from "./useMutation";
import { useQuery as queryHook } from "./useQuery";

export * from "./useQuery";
export * from "./useMultipleQueries";
export * from "./useMutation";
export * from "./useAtom";

export type Use = typeof atomHook &
  typeof mutationHook &
  typeof queryHook &
  typeof multipleQueriesHook;

const use: Use = (input: any, options?: any): any => {
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
