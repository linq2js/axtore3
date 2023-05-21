import { useApolloClient } from "@apollo/client";
import { useMemo } from "react";
import { useStable } from ".";
import { Model, ModelAction } from "../types";

const createUseActionHooks =
  <TContext, TMeta>({ call }: Model<TContext, TMeta>) =>
  <TActions extends Record<string, ModelAction<TContext, TMeta, any[], any>>>(
    actions: TActions
  ): {
    [key in keyof TActions]: TActions[key] extends ModelAction<
      TContext,
      TMeta,
      infer TArgs,
      infer TResult
    >
      ? (...args: TArgs) => TResult
      : never;
  } => {
    const client = useApolloClient();
    const actionWrappers = useMemo(() => {
      return Object.keys(actions).reduce((prev, key) => {
        return {
          ...prev,
          [key]: (...args: any[]) => call(client, actions[key], ...args),
        };
      }, {} as any);
    }, [actions, call]);
    return useStable(actionWrappers) as any;
  };

export { createUseActionHooks };
