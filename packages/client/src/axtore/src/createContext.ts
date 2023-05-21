import { all, race } from "./async";
import { concurrency } from "./concurrency";
import { createEventDispatcher } from "./createEventDispatcher";
import { createLazy } from "./createLazy";
import { createMutationDispatcher } from "./createMutationDispatcher";
import { createQueryDispatcher } from "./createQueryDispatcher";
import { createStateDispatcher } from "./createStateDispatcher";
import { evictQuery } from "./evictQuery";
import type { ApolloContext, QueryInfo, Session } from "./types";
import { delay, EMPTY, isEvent, isMutation, isQuery, isState } from "./util";

const createContext = (
  originalContext: ApolloContext,
  session: Session,
  meta: any,
  updatable: boolean,
  getSharedData?: () => any
) => {
  let shared: any;
  let lastData = EMPTY;
  const use = (extras: Function, ...args: any[]) =>
    extras(contextProxy, ...args);

  const resolvedProps = new Map<any, any>([
    ["use", use],
    ["context", originalContext],
    ["client", originalContext.client],
    ["lazy", createLazy],
    ["delay", delay],
    ["all", all],
    ["race", race],
  ]);
  const contextProxy = new Proxy(
    {},
    {
      get(_, p) {
        if (p === "shared") {
          if (!shared) {
            shared = getSharedData ? getSharedData() : {};
          }
          return shared;
        }

        if (p === "lastData") {
          if (lastData === EMPTY) {
            lastData = session.manager.query
              ? session.manager.observableQuery.getLastResult()?.data
              : undefined;
          }
          return lastData;
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
              contextProxy
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

          if (isEvent(value)) {
            const dispatcher = createEventDispatcher(
              originalContext.client,
              value
            );
            resolvedProps.set(p, dispatcher);
            return dispatcher;
          }

          if (isState(value)) {
            const derivedQuery = session.manager.query;
            const dispatcher = createStateDispatcher(
              originalContext,
              value,
              session,
              updatable,
              meta
            );
            resolvedProps.set(p, dispatcher);
            return dispatcher;
          }
        }

        if (p in originalContext) {
          let value = (originalContext as any)[p];
          if (
            typeof value === "function" &&
            (value as any).type === "dispatcher"
          ) {
            value = value(contextProxy);
          }
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
