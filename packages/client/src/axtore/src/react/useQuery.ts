import type {
  ApolloError,
  ObservableQuery,
  OperationVariables,
} from "@apollo/client";
import { useQuery as apolloUseQuery, useApolloClient } from "@apollo/client";
import type {
  Client,
  NoInfer,
  Query,
  VariablesOptions,
  WithVariables,
} from "../types";
import { useRef, useState } from "react";
import { useStable } from "./useStable";
import { evictQuery } from "../evictQuery";
import { refetchAllQueries } from "../refetchAllQueries";
import { evictAllQueries } from "../evictAllQueries";
import { getObservableQuery } from "../getObservableQuery";

export type UseQueryOptions<TData> = {
  onCompleted?: (data: TData) => void;
  onError?: (error: ApolloError) => void;
  onDone?: VoidFunction;
  context?: any;
};

export type Wait<T> = {
  (): T;
  (defaultValue: () => T): T;
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
  query.model.init(client);
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

  const queryOptions = {
    notifyOnNetworkStatusChange: true,
    ...mergedOptions,
    ...stableOptions,
  };
  const result = apolloUseQuery<TData, any>(query.document, queryOptions);
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
      refetchAll() {
        refetchAllQueries(client, query);
      },
      evict() {
        return evictQuery(client, query, customOptions.variables);
      },
      evictAll() {
        evictAllQueries(client, query);
      },
      wait() {
        if (resultRef.current.error) {
          throw resultRef.current.error;
        }
        if (
          resultRef.current.loading ||
          isLoading(resultRef.current.observable)
        ) {
          wait(client, query, customOptions.variables);
        }

        return resultRef.current.data as TData;
      },
    };
  })[0];
};

const isLoading = <TVariables extends OperationVariables>(
  observableQuery: ObservableQuery<any, TVariables>
) => {
  const result = observableQuery.getCurrentResult();
  return result.loading || result.networkStatus === 4;
};

const wait = (client: Client, query: Query, variables: any) => {
  const observable = getObservableQuery(client, query, variables);
  const result = observable.getCurrentResult();

  if (result.loading) {
    throw new Promise<void>((resolve) => {
      observable.onNext(resolve, true);
    });
  }

  if (result.error) {
    throw result.error;
  }
};

export { useQuery, wait };
