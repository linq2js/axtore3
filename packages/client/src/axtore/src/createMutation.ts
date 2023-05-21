import type { DocumentNode } from "graphql";
import type { Model, Mutation, MutationOptions, RootResolver } from "./types";
import { wrapVariables } from "./util";

const createMutation = <TContext, TMeta, TVariables, TData>(
  model: Model<TContext, TMeta>,
  name: string,
  document: DocumentNode,
  resolver?: RootResolver<any, TVariables, TData>,
  options: MutationOptions<TVariables> = {}
): Mutation<TVariables, TData> => {
  return {
    type: "mutation",
    name,
    model,
    document,
    resolver,
    options,
    mergeOptions(newOptions) {
      return {
        ...newOptions,
        mutation: document,
        variables: wrapVariables(!!resolver, newOptions?.variables),
      };
    },
  };
};

export { createMutation };
