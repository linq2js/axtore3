import { concurrency } from "./concurrency";
import { createContext } from "./createContext";
import { evictQuery } from "./evictQuery";
import { getSessionManager } from "./getSessionManager";
import { handleLazyResult } from "./handleLazyResult";
import { patchTypeIfPossible } from "./patchTypeIfPossible";
import { ApolloContext, Client, CustomContextFactory, Query } from "./types";
import { unwrapVariables } from "./util";

const STALE_TIMER_PROP = Symbol("staleTimer");

const createQueryResolver = <TContext, TMeta>(
  client: Client,
  query: Query,
  contextFactory: CustomContextFactory<TContext>,
  meta: TMeta
) => {
  return async (_: any, args: any, apolloContext: ApolloContext) => {
    args = unwrapVariables(args);
    const sm = getSessionManager(client, query.document, args);
    sm.query = query;
    clearTimeout(sm.data[STALE_TIMER_PROP]);

    return concurrency(sm, query.options, async () => {
      const session = sm.start();

      if (!query.options.proactive) {
        sm.invalidate = () => {
          if (!session.isActive) return;
          if (query.options.hardRefetch) {
            // we also apply concurrency for refetching logic
            concurrency(
              sm,
              query.options.debounce ? query.options : {},
              async () => {
                evictQuery(client, query, sm.observableQuery.variables);
              }
            );
            return;
          }
          sm.observableQuery.refetch();
        };
      }

      const context = createContext(
        {
          ...apolloContext,
          ...contextFactory(apolloContext),
        },
        session,
        meta,
        false
      );
      const result = await handleLazyResult(
        client,
        session,
        "query",
        () => query.mergeOptions({ variables: args }),
        query.name,
        await query.resolver?.(context, args)
      );

      sm.onLoad.invokeAndClear();

      if (query.options.type) {
        return patchTypeIfPossible(result, query.options.type);
      }

      if (query.options.stateTime) {
        sm.data[STALE_TIMER_PROP] = setTimeout(() => {
          evictQuery(client, query, args);
        }, query.options.stateTime);
      }

      return result;
    });
  };
};

export { createQueryResolver };
