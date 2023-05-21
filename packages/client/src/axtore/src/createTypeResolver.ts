import { createContext } from "./createContext";
import { getSessionManager } from "./getSessionManager";
import { handleLazyResult } from "./handleLazyResult";
import { patchTypeIfPossible } from "./patchTypeIfPossible";
import {
  ApolloContext,
  Client,
  CustomContextFactory,
  FieldOptions,
} from "./types";
import { unwrapVariables } from "./util";

const createTypeResolver = <TContext, TMeta>(
  client: Client,
  resolver: Function,
  field: string,
  contextFactory: CustomContextFactory<TContext>,
  meta: TMeta
) => {
  const options = (resolver as any).options as FieldOptions;

  return async (parent: any, args: any, apolloContext: ApolloContext) => {
    args = unwrapVariables(args);

    if (options.parse) {
      args = options.parse(args);
    }

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

    if (options.type) {
      return patchTypeIfPossible(result, options.type);
    }

    return result;
  };
};

export { createTypeResolver };
