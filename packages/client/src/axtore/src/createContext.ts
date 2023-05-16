import { concurrency } from "./concurrency";
import { createMutationDispatcher } from "./createMutationDispatcher";
import { createQueryDispatcher } from "./createQueryDispatcher";
import { createStateDispatcher } from "./createStateDispatcher";
import { evictQuery } from "./evictQuery";
import { ApolloContext, QueryInfo, Session } from "./types";
import { isMutation, isQuery, isState } from "./util";

const createContext = (
  originalContext: ApolloContext,
  session: Session,
  meta: any,
  updatable: boolean,
  getDerivedQuery?: () => QueryInfo,
  recomputeDerivedState?: VoidFunction,
  getSharedData?: () => any
) => {
  let data: any;
  const use = (extras: Function, ...args: any[]) =>
    extras(contextProxy, ...args);
  const resolvedProps = new Map<any, any>([
    ["use", use],
    ["context", originalContext],
    ["client", originalContext.client],
  ]);
  const contextProxy = new Proxy(
    {},
    {
      get(_, p) {
        if (p === "shared") {
          if (!data) {
            data = getSharedData ? getSharedData() : {};
          }
          return data;
        }

        if (resolvedProps.has(p)) {
          return resolvedProps.get(p);
        }

        // query/mutation dispatcher
        if (typeof p === "string" && p[0] === "$" && p.slice(1) in meta) {
          const value = meta[p.slice(1)];

          if (isQuery(value)) {
            const dispatcher = createQueryDispatcher(
              originalContext.client,
              value,
              session,
              contextProxy,
              getDerivedQuery
            );
            resolvedProps.set(p, dispatcher);
            return dispatcher;
          }

          if (isMutation(value)) {
            const dispatcher = createMutationDispatcher(
              originalContext.client,
              value,
              contextProxy
            );
            resolvedProps.set(p, dispatcher);
            return dispatcher;
          }

          if (isState(value)) {
            const dispatcher = createStateDispatcher(
              originalContext,
              value,
              session,
              updatable,
              meta,
              recomputeDerivedState ??
                (getDerivedQuery &&
                  (() => {
                    const qi = getDerivedQuery();
                    if (qi.query.options.hardRefetch) {
                      // we also apply concurrency for refetching logic
                      concurrency(
                        session.manager,
                        qi.query.options.debounce ? qi.query.options : {},
                        async () => {
                          evictQuery(
                            originalContext.client,
                            qi.query,
                            qi.observable.variables
                          );
                        }
                      );
                      return;
                    }
                    qi.observable.refetch();
                  }))
            );
            resolvedProps.set(p, dispatcher);
            return dispatcher;
          }
        }

        if (p in originalContext) {
          const value = (originalContext as any)[p];
          resolvedProps.set(p, value);
          return value;
        }

        throw new Error(`Unknown prop ${p as any}`);
      },
    }
  ) as any;
  return contextProxy;
};

export { createContext };
