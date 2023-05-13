import {
  ApolloError,
  useQuery as queryHook,
  useApolloClient,
} from "@apollo/client";
import {
  Loadable,
  LoadableSource,
  NoInfer,
  Query,
  VariablesOptions,
} from "../types";
import { UseQueryOptions, wait } from "./useQuery";
import { isLoadable, isQuery } from "../util";

import { useRef } from "react";

const useMultipleLoadables = <
  TLoadableMap extends Record<string, Query<any, any> | Loadable>
>(
  loadableMap: TLoadableMap,
  options?: {
    [key in keyof TLoadableMap]: TLoadableMap[key] extends Query<
      infer TVariables,
      infer TData
    >
      ? NoInfer<
          VariablesOptions<TVariables, UseQueryOptions<TData> | undefined>
        >[0]
      : never;
  }
): {
  [key in keyof TLoadableMap]: TLoadableMap[key] extends Query<
    infer _,
    infer TData
  >
    ? TData
    : TLoadableMap[key] extends LoadableSource<infer T>
    ? T
    : never;
} => {
  const client = useApolloClient();
  const entries = Object.entries(loadableMap);
  const lengthRef = useRef(entries.length);
  if (lengthRef.current !== entries.length) {
    throw new Error("Invalid number of queries. Changed since last rendering");
  }
  const allResults: Record<string, any> = {};
  const errors: ApolloError[] = [];
  const promises: Promise<void>[] = [];

  entries.forEach(([key, input]) => {
    let promise: Promise<void> | undefined;
    let error: ApolloError | undefined;
    let data: any;

    if (isLoadable(input)) {
      const loadable = input();
      if (loadable.loading) {
        promise = loadable.promise as Promise<void>;
      } else if (loadable.error) {
        error = new ApolloError({ clientErrors: [loadable.error as Error] });
      } else {
        data = loadable.data;
      }
    } else if (isQuery(input)) {
      const handler = input.use(client);
      const queryOptions = (options?.[key] as any) ?? {};
      const mergedOptions = handler.mergeOptions(queryOptions);

      const result = queryHook(input.document, mergedOptions);

      if (result.loading) {
        promise = wait(result.observable);
      } else if (result.error) {
        error = result.error;
      } else {
        data = result.data;
      }
    }

    if (promise) {
      promises.push(promise);
      return;
    }

    if (error) {
      errors.push(error);
      return;
    }

    allResults[key] = data;
  });

  if (errors.length) {
    throw errors[0];
  }

  if (promises.length) {
    throw Promise.all(promises);
  }

  return allResults as any;
};

export { useMultipleLoadables };
