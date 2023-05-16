import type {
  RemovePrefix,
  Query,
  SkipFirstArg,
  Mutation,
  State,
  NormalizeProps,
  Model,
} from "../types";
import { useQuery } from "./useQuery";
import { useMutation } from "./useMutation";
import { isState, isMutation, isQuery } from "../util";
import {
  useApolloClient,
  useReactiveVar as reactiveVarHook,
} from "@apollo/client";
import { useMemo } from "react";

type InferHook<T> = T extends Query<infer TVariables, infer TData>
  ? SkipFirstArg<typeof useQuery<TVariables, TData>>
  : T extends Mutation<infer TVariables, infer TData>
  ? SkipFirstArg<typeof useMutation<TVariables, TData>>
  : T extends State<infer TData>
  ? SkipFirstArg<typeof reactiveVarHook<TData>>
  : never;

type InferHooks<TMeta, TPrefix extends string = ""> = NormalizeProps<{
  [key in `use${TPrefix}${Capitalize<keyof TMeta & string>}`]: InferHook<
    TMeta[Uncapitalize<RemovePrefix<`use${TPrefix}`, key>> & keyof TMeta]
  >;
}>;

export type CreateHooks = {
  <TMeta>(meta: TMeta): InferHooks<TMeta>;
  <TMeta, TPrefix extends string>(
    meta: TMeta,
    options: { prefix: TPrefix }
  ): InferHooks<TMeta, TPrefix>;
};

const createHooks: CreateHooks = (meta: any, options?: any) => {
  const { prefix = "" } = options ?? {};
  const result: any = {};
  const entries = Object.entries(meta);
  const models = new Set<Model>();
  const groupId = Symbol("hooks");

  const useInitGroup = () => {
    const client = useApolloClient();
    // we use symbol to mark whether the group is connected or not
    if (!(client as any)[groupId]) {
      (client as any)[groupId] = true;
      models.forEach((model) => model.init(client));
    }
  };

  entries.forEach(([key, value]) => {
    const name = `use${prefix}${key[0].toUpperCase()}${key.slice(1)}`;
    let hook: Function | undefined;

    if (isQuery(value)) {
      models.add(value.model);
      hook = (...args: any[]) => {
        useInitGroup();
        return (useQuery as Function)(value, ...args);
      };
    } else if (isMutation(value)) {
      models.add(value.model);
      hook = (...args: any[]) => {
        useInitGroup();
        return useMutation(value, ...args);
      };
    } else if (isState(value)) {
      models.add(value.model);
      hook = (...args: any[]) => {
        useInitGroup();
        const client = useApolloClient();
        const rv = useMemo(() => {
          return value.model.call(client, (x) => (x as any)["$" + key].rv);
        }, [client]);
        return (reactiveVarHook as Function)(rv, ...args);
      };
    }

    if (hook) {
      result[name] = hook;
    }
  });
  return result;
};

export { createHooks };
