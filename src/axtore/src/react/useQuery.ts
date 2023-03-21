import {
  ApolloError,
  FetchPolicy,
  ObservableQuery,
  useQuery as apolloUseQuery,
  useApolloClient,
} from "@apollo/client";
import { NoInfer, Query, VariablesOptions, WithVariables } from "../types";
import { useRef, useState } from "react";

import { useStable } from "./useStable";

export type UseQueryOptions<TData> = {
  onCompleted?: (data: TData) => void;
  onError?: (error: ApolloError) => void;
  fetchPolicy?: FetchPolicy;
  onDone?: VoidFunction;
  context?: any;
};

const useQuery = <TVariables, TData>(
  query: Query<TVariables, TData>,
  ...args: NoInfer<
    VariablesOptions<TVariables, UseQueryOptions<TData> | undefined>
  >
) => {
  const { onCompleted, onError, onDone, ...customOptions } =
    (args[0] as WithVariables<TVariables, UseQueryOptions<TData>>) ?? {};
  const client = useApolloClient();
  const mergedOptions = query.mergeOptions(customOptions);
  const stableOptions = useStable({
    onCompleted:
      onCompleted || onDone
        ? (data: TData) => {
            onCompleted?.(data);
            onDone?.();
          }
        : undefined,
    onError:
      onError || onDone
        ? (error: ApolloError) => {
            // call global error handler
            onError?.(error);
            onDone?.();
          }
        : undefined,
  });
  query.use(client);
  const result = apolloUseQuery(query.document, {
    ...mergedOptions,
    ...stableOptions,
  });
  const resultRef = useRef(result);
  resultRef.current = result;

  return useState(() => {
    return {
      get called() {
        return resultRef.current.called;
      },
      get data() {
        return resultRef.current.data;
      },
      get loading() {
        return resultRef.current.loading;
      },
      get error() {
        return resultRef.current.error;
      },
      get networkStatus() {
        return resultRef.current.networkStatus;
      },
      get previousData() {
        return resultRef.current.previousData;
      },
      refetch() {
        return resultRef.current.refetch();
      },
      wait() {
        if (resultRef.current.loading) {
          throw wait(resultRef.current.observable);
        }
        if (resultRef.current.error) {
          throw resultRef.current.error;
        }
        return resultRef.current.data as TData;
      },
    };
  })[0];
};

const wait = <TData>(observable: ObservableQuery<TData, any>) => {
  return new Promise<TData>((resolve, reject) => {
    const subscription = observable.subscribe((r) => {
      if (r.loading) return;
      subscription.unsubscribe();
      if (r.error) {
        reject(r.error);
      } else {
        resolve(r.data);
      }
    });
  });
};

export { useQuery, wait };
