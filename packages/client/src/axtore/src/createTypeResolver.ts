import { createContext } from "./createContext";
import { getSessionManager } from "./getSessionManager";
import { handleLazyResult } from "./handleLazyResult";
import { ApolloContext, Client, CustomContextFactory } from "./types";
import { unwrapVariables } from "./util";

const createTypeResolver = <TContext, TMeta>(
  client: Client,
  resolver: Function,
  field: string,
  contextFactory: CustomContextFactory<TContext>,
  meta: TMeta
) => {
  return async (parent: any, args: any, apolloContext: ApolloContext) => {
    args = unwrapVariables(args);
    const sm = getSessionManager(client, false);
    const session = sm.start();
    const context = createContext(
      {
        ...apolloContext,
        ...contextFactory(apolloContext),
      },
      session,
      meta,
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
    return result;
  };
};

export { createTypeResolver };
