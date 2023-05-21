import type { ApolloError, MutationHookOptions } from "@apollo/client";
import {
  useMutation as apolloUseMutation,
  useApolloClient,
} from "@apollo/client";
import type { Mutation, NoInfer, VariablesArgs } from "../types";
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
  mutation.model.init(client);
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

  const [mutate, result] = apolloUseMutation<TData, TVariables>(
    mutation.document,
    {
      ...mergedOptions,
      ...stableOptions,
    }
  );

  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;

  const resultRef = useRef(result);
  resultRef.current = result;

  return useMemo(() => {
    const mutate = (...args: VariablesArgs<TVariables>) => {
      const options = mutation.mergeOptions({ variables: args[0] });
      return mutateRef.current(options);
    };

    Object.defineProperties(mutate, {
      called: { get: () => resultRef.current.called },
      data: { get: () => resultRef.current.data },
      loading: { get: () => resultRef.current.loading },
      error: { get: () => resultRef.current.error },
    });

    Object.assign(mutate, {
      reset() {
        return resultRef.current.reset();
      },
    });

    return mutate as typeof mutate & {
      readonly called: boolean;
      readonly loading: boolean;
      readonly data?: TData | null;
      readonly error?: ApolloError;
    };
  }, []);
};

export { useMutation };
