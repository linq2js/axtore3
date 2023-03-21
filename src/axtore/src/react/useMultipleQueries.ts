import {
  ApolloError,
  useQuery as queryHook,
  useApolloClient,
} from "@apollo/client";
import { NoInfer, Query, VariablesOptions } from "../types";
import { UseQueryOptions, wait } from "./useQuery";

import { useRef } from "react";

const useMultipleQueries = <TQueries extends Record<string, Query<any, any>>>(
  queries: TQueries,
  options?: {
    [key in keyof TQueries]: TQueries[key] extends Query<
      infer TVariables,
      infer TData
    >
      ? NoInfer<
          VariablesOptions<TVariables, UseQueryOptions<TData> | undefined>
        >[0]
      : never;
  }
): {
  [key in keyof TQueries]: TQueries[key] extends Query<infer _, infer TData>
    ? TData
    : never;
} => {
  const client = useApolloClient();
  const entries = Object.entries(queries);
  const lengthRef = useRef(entries.length);
  if (lengthRef.current !== entries.length) {
    throw new Error("Invalid number of queries. Changed since last rendering");
  }
  const allResults: Record<string, any> = {};
  const errors: ApolloError[] = [];
  const promises: Promise<void>[] = [];

  entries.forEach(([key, query]) => {
    query.use(client);
    const queryOptions = (options?.[key] as any) ?? {};
    const mergedOptions = query.mergeOptions(queryOptions);

    const result = queryHook(query.document, mergedOptions);

    if (result.loading) {
      promises.push(wait(result.observable));
      return;
    }

    if (result.error) {
      errors.push(result.error);
      return;
    }

    allResults[key] = result.data;
  });

  if (errors.length) {
    throw errors[0];
  }

  if (promises.length) {
    throw Promise.all(promises);
  }

  return allResults as any;
};

export { useMultipleQueries };
