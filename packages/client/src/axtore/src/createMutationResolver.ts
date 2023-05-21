import { concurrency } from "./concurrency";
import { createContext } from "./createContext";
import { getData } from "./getData";
import { getSessionManager } from "./getSessionManager";
import { patchTypeIfPossible } from "./patchTypeIfPossible";
import { ApolloContext, Client, CustomContextFactory, Mutation } from "./types";
import { unwrapVariables } from "./util";

const createMutationResolver = <TContext, TMeta>(
  client: Client,
  mutation: Mutation,
  contextFactory: CustomContextFactory<TContext>,
  meta: TMeta
) => {
  return async (_: any, args: any, apolloContext: ApolloContext) => {
    args = unwrapVariables(args);
    const sm = getSessionManager(client, false);
    sm.mutation = mutation;

    return concurrency(mutation, mutation.options, async () => {
      const session = sm.start();
      const context = createContext(
        {
          ...apolloContext,
          ...contextFactory(apolloContext),
        },
        session,
        meta,
        true,
        // create simple data object for mutation
        () => getData(client, mutation, {}, (_, key) => ({ key }))
      );
      const data = await mutation.resolver?.(context, args);

      if (mutation.options.type) {
        return patchTypeIfPossible(data, mutation.options.type);
      }

      return data;
    });
  };
};

export { createMutationResolver };
