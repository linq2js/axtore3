import type {
  RemovePrefix,
  Query,
  SkipFirstArg,
  Mutation,
  State,
  NormalizeProps,
  Model,
  Event,
  RemovePrivateProps,
  Client,
} from "../types";
import { useQuery } from "./useQuery";
import { useMutation } from "./useMutation";
import { createUseActionHooks } from "./createUseActionHooks";
import { isState, isMutation, isQuery, isEvent, isModel } from "../util";
import {
  useApolloClient,
  useReactiveVar as useReactiveVar,
} from "@apollo/client";
import { useMemo } from "react";
import { useEvent } from "./useEvent";

export type InferHook<T> = T extends Model<infer TContext, infer TMeta>
  ? ReturnType<typeof createUseActionHooks<TContext, TMeta>>
  : T extends Query<infer TVariables, infer TData>
  ? SkipFirstArg<typeof useQuery<TVariables, TData>>
  : T extends Mutation<infer TVariables, infer TData>
  ? SkipFirstArg<typeof useMutation<TVariables, TData>>
  : T extends Event<infer TArgs>
  ? SkipFirstArg<typeof useEvent<TArgs>>
  : T extends State<infer TData>
  ? (options?: { client?: Client }) => TData
  : never;

export type InferHooks<TMeta, TPrefix extends string = ""> = NormalizeProps<
  {
    [key in `use${TPrefix}${Capitalize<keyof TMeta & string>}`]: InferHook<
      TMeta[Uncapitalize<RemovePrefix<`use${TPrefix}`, key>> & keyof TMeta]
    >;
  } & { [key in `use${TPrefix}Init`]: VoidFunction }
>;

export type CreateHookOptions = {
  client?: Client;
};

export type CreateHooks = {
  <TMeta>(meta: TMeta, options?: CreateHookOptions): InferHooks<
    RemovePrivateProps<TMeta>
  >;
  <TMeta, TPrefix extends string>(
    meta: TMeta,
    options: { prefix: TPrefix } & CreateHookOptions
  ): InferHooks<RemovePrivateProps<TMeta>, TPrefix>;
};

const createHooks: CreateHooks = (
  meta: any,
  options: CreateHookOptions & { prefix?: string } = {}
) => {
  const { prefix = "", client: defaultClient } = options;
  const result: any = {};
  const entries = Object.entries(meta);
  const models = new Set<Model>();
  const groupId = Symbol("hooks");

  const useInit = (override?: Client) => {
    const client = useApolloClient(override ?? defaultClient);
    // we use symbol to mark whether the group is connected or not
    if (!(client as any)[groupId]) {
      (client as any)[groupId] = true;
      models.forEach((model) => model.init(client));
    }
    return client;
  };

  entries.forEach(([key, value]) => {
    if (key[0] === "_") return;
    const name = `use${prefix}${key[0].toUpperCase()}${key.slice(1)}`;
    let hook: Function | undefined;

    if (isQuery(value)) {
      models.add(value.model);
      hook = (options: any) => {
        const client = useInit(options?.client);
        return useQuery(value, { client, ...options });
      };
    } else if (isMutation(value)) {
      models.add(value.model);
      hook = (options: any) => {
        const client = useInit(options?.client);
        return useMutation(value, { client, ...options });
      };
    } else if (isState(value)) {
      models.add(value.model);
      hook = (options: any) => {
        const client = useInit(options?.client);
        const rv = useMemo(() => {
          return value.model.call(client, (x) => (x as any)["$" + key].rv);
        }, [client]);
        return useReactiveVar(rv);
      };
    } else if (isEvent(value)) {
      models.add(value.model);
      hook = (options: any) => {
        const client = useInit(options?.client);
        return useEvent(value, { client, ...options });
      };
    } else if (isModel(value)) {
      models.add(value);
      hook = createUseActionHooks(value, defaultClient);
    }

    if (hook) {
      result[name] = hook;
    }
  });

  result[`use${prefix}Init`] = useInit;

  return result;
};

export { createHooks };
