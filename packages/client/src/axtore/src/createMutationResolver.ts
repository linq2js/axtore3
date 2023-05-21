import { concurrency } from "./concurrency";
import { createContext } from "./createContext";
import { getSessionManager } from "./getSessionManager";
import { patchTypeIfPossible } from "./patchTypeIfPossible";
import { ApolloContext, Client, CustomContextFactory, Mutation } from "./types";
import { unwrapVariables } from "./util";

const createMutationResolver = <TContext, TMeta>(
  client: Client,
  mutation: Mutation,
  contextFactory: CustomContextFactory<TContext>
) => {
  return async (_: any, args: any, apolloContext: ApolloContext) => {
    args = unwrapVariables(args);
    if (mutation.options.parse) {
      args = mutation.options.parse(args);
    }

    const sm = getSessionManager(client, mutation);
    sm.mutation = mutation;

    return concurrency(mutation, mutation.options, async () => {
      const session = sm.start();
      const context = createContext(
        mutation.model,
        {
          ...apolloContext,
          ...contextFactory(apolloContext),
        },
        session,
        true
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
