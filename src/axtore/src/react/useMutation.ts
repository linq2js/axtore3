import {
  ApolloError,
  MutationHookOptions,
  useMutation as apolloUseMutation,
  useApolloClient,
} from "@apollo/client";
import { Mutation, NoInfer, VariablesArgs } from "../types";
import { useMemo, useRef } from "react";

import { useStable } from "./useStable";

export type UseMutationOptions<TData> = {
  onCompleted?: NoInfer<(data: TData) => void>;
  onError?: (error: ApolloError) => void;
  onDone?: VoidFunction;
  fetchPolicy?: MutationHookOptions["fetchPolicy"];
};

const useMutation = <TVariables, TData>(
  mutation: Mutation<TVariables, TData>,
  options: UseMutationOptions<TData> = {}
) => {
  const { onCompleted, onError, onDone, ...customOptions } = options;
  const client = useApolloClient();
  const mergedOptions = mutation.mergeOptions(customOptions);
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
  mutation.use(client);
  const [mutate, result] = apolloUseMutation(mutation.document, {
    ...mergedOptions,
    ...stableOptions,
  });

  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;

  const resultRef = useRef(result);
  resultRef.current = result;

  return useMemo(() => {
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
      reset() {
        return resultRef.current.reset();
      },
      async mutate(...args: VariablesArgs<TVariables>) {
        const options = mutation.mergeOptions({ variables: args[0] });
        return mutateRef.current(options);
      },
    };
  }, []);
};

export { useMutation };
