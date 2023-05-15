import {
  RemovePrefix,
  Query,
  SkipFirstArg,
  Mutation,
  State,
  NormalizeProps,
} from "../types";
import { useQuery as queryHook } from "./useQuery";
import { useMutation as mutationHook } from "./useMutation";
import { isState, isMutation, isQuery } from "../util";
import {
  useApolloClient,
  useReactiveVar as reactiveVarHook,
} from "@apollo/client";
import { useMemo } from "react";

type InferHook<T> = T extends Query<infer TVariables, infer TData>
  ? SkipFirstArg<typeof queryHook<TVariables, TData>>
  : T extends Mutation<infer TVariables, infer TData>
  ? SkipFirstArg<typeof mutationHook<TVariables, TData>>
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
  Object.entries(meta).forEach(([key, value]) => {
    const hookName = `use${prefix}${key[0].toUpperCase()}${key.slice(1)}`;
    let hookImplement: Function | undefined;

    if (isQuery(value)) {
      hookImplement = (...args: any[]) =>
        (queryHook as Function)(value, ...args);
    } else if (isMutation(value)) {
      hookImplement = (...args: any[]) =>
        (mutationHook as Function)(value, ...args);
    } else if (isState(value)) {
      hookImplement = (...args: any[]) => {
        const client = useApolloClient();
        let rv = useMemo(() => {
          value.model.init(client);
          return value.model.call(client, (x) => (x as any)["$" + key].rv);
        }, [client]);
        return (reactiveVarHook as Function)(rv, ...args);
      };
    }
    if (hookImplement) {
      result[hookName] = hookImplement;
    }
  });
  return result;
};

export { createHooks };
