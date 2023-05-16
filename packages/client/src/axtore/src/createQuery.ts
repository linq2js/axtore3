import type { DocumentNode } from "graphql";
import type { Model, Query, QueryOptions, RootResolver } from "./types";
import { wrapVariables } from "./util";

const createQuery = <TVariables, TData>(
  model: Model<any, any>,
  name: string,
  document: DocumentNode,
  resolver?: RootResolver<any, TVariables, TData>,
  options: QueryOptions = {}
): Query<TVariables, TData> => {
  return {
    type: "query",
    name,
    model,
    document,
    resolver,
    options,
    mergeOptions(newOptions) {
      return {
        ...newOptions,
        query: document,
        variables: wrapVariables(!!resolver, newOptions?.variables),
      };
    },
  };
};

export { createQuery };
