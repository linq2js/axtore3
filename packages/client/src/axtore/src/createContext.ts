import { all, race } from "./async";
import { createEventDispatcher } from "./createEventDispatcher";
import { createLazy } from "./createLazy";
import { createMutationDispatcher } from "./createMutationDispatcher";
import { createQueryDispatcher } from "./createQueryDispatcher";
import { createStateDispatcher } from "./createStateDispatcher";
import type { ApolloContext, Model, Session } from "./types";
import { delay, EMPTY, isEvent, isMutation, isQuery, isState } from "./util";

const defaultContextProps = [
  ["lazy", createLazy],
  ["delay", delay],
  ["all", all],
  ["race", race],
] as const;

const createContext = (
  model: Model<any, any>,
  originalContext: ApolloContext,
  session: Session,
  updatable: boolean
) => {
  let lastData: any = EMPTY;
  const use = (extras: Function, ...args: any[]) => {
    return extras(contextProxy, ...args);
  };

  const resolvedProps = new Map<any, any>([
    ...defaultContextProps,
    ["use", use],
    ["context", originalContext],
    ["client", originalContext.client],
  ]);
  const contextProxy = new Proxy(
    {},
    {
      get(_, p) {
        if (p === "shared") {
          return session.manager.data;
        }

        if (p === "lastData") {
          if (lastData === EMPTY) {
            if (session.manager.query) {
              console.log(session.manager.query.alias);
              lastData =
                session.manager.observableQuery.getLastResult()?.data?.[
                  session.manager.query.alias
                ];
            } else {
              lastData = undefined;
            }
            console.log(lastData);
          }
          return lastData;
        }

        if (resolvedProps.has(p)) {
          return resolvedProps.get(p);
        }

        // is query/mutation/state/event dispatcher
        if (typeof p === "string" && p[0] === "$" && p.slice(1) in model.meta) {
          const value = model.meta[p.slice(1)];

          if (isQuery(value)) {
            const dispatcher = createQueryDispatcher(
              originalContext.client,
              value,
              session,
              value.model === model
                ? contextProxy
                : createContext(
                    value.model,
                    originalContext,
                    session,
                    updatable
                  )
            );
            resolvedProps.set(p, dispatcher);
            return dispatcher;
          }

          if (isMutation(value)) {
            const dispatcher = createMutationDispatcher(
              originalContext.client,
              value,
              value.model === model
                ? contextProxy
                : createContext(
                    value.model,
                    originalContext,
                    session,
                    updatable
                  )
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
            const dispatcher = createStateDispatcher(
              originalContext,
              value,
              session,
              updatable
            );
            resolvedProps.set(p, dispatcher);
            return dispatcher;
          }

          if (typeof value === "function") {
            const dispatcher = value(contextProxy);
            resolvedProps.set(p, dispatcher);
            return dispatcher;
          }
        } else if (p in originalContext) {
          let value = (originalContext as any)[p];
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
