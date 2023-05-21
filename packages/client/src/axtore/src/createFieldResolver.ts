import { createContext } from "./createContext";
import { getSessionManager } from "./getSessionManager";
import { handleLazyResult } from "./handleLazyResult";
import { patchTypeIfPossible } from "./patchTypeIfPossible";
import { ApolloContext, Client, CustomContextFactory, Field } from "./types";
import { unwrapVariables } from "./util";

const createFieldResolver = <TContext>(
  client: Client,
  resolver: Field,
  field: string,
  contextFactory: CustomContextFactory<TContext>
) => {
  const { options, model } = resolver;

  return async (parent: any, args: any, apolloContext: ApolloContext) => {
    args = unwrapVariables(args);

    if (options.parse) {
      args = options.parse(args);
    }

    const sm = getSessionManager(client, resolver, args);
    const session = sm.start();
    const context = createContext(
      model,
      {
        ...apolloContext,
        ...contextFactory(apolloContext),
      },
      session,
      false
    );
    const rawResult = await resolver(context, args, parent);
    const result = await handleLazyResult(
      client,
      session,
      "type",
      () => client.cache.identify(parent),
      field,
      rawResult
    );
    session.manager.onLoad.invokeAndClear();

    if (options.type) {
      return patchTypeIfPossible(result, options.type);
    }

    return result;
  };
};

export { createFieldResolver };
