import {
  CreateMutationOptions,
  EMPTY_RESOLVERS,
  Mutation,
  MutationHandler,
  NoInfer,
  TypeDef,
} from "./types";

import { DocumentNode } from "graphql";
import { addResolvers } from "./resolverUtils";
import { createProp } from "./util";
import { generateName } from "./generateName";

const createMutation = <TVariables, TData>(
  document: DocumentNode,
  typeDefs: TypeDef[],
  resolvers: Record<string, any> = EMPTY_RESOLVERS,
  options: NoInfer<
    CreateMutationOptions<TVariables> & { dynamic?: boolean }
  > = {}
): Mutation<TVariables, TData> => {
  const {
    variables: defaultVariables,
    context: defaultContext,
    fetchPolicy,
    dynamic,
  } = options;
  const connectedProp = Symbol(generateName("mutation"));

  const mergeOptions: Mutation["mergeOptions"] = (options) => {
    const variables = { ...defaultVariables, ...options?.variables };
    return {
      mutation: document,
      fetchPolicy,
      variables: dynamic ? { input: variables } : variables,
      context: { ...defaultContext, ...options?.context },
    };
  };

  const mutation: Mutation = {
    type: "mutation",
    document,
    mergeOptions,
    use(client) {
      return createProp(
        client,
        connectedProp,
        (): MutationHandler<any, any> => {
          addResolvers(client, mutation, resolvers, typeDefs);

          return {
            async call(...args: any[]) {
              const queryOptions = mergeOptions({
                variables: args[0]?.variables,
              });
              const result = await client.mutate(queryOptions);
              if (!result) throw new Error("Invalid query data");
              if (result.errors?.length) throw result.errors[0];
              return result.data;
            },
          };
        }
      );
    },
  };

  return mutation;
};

export { createMutation };
