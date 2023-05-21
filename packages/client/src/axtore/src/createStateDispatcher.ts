import { makeVar } from "@apollo/client";
import { callbackGroup } from "./callbackGroup";
import { createContext } from "./createContext";
import { getSessionManager } from "./getSessionManager";
import { getUpdatedData } from "./getUpdatedData";
import type { ApolloContext, Session, State } from "./types";
import { createProp } from "./util";

const createState = (
  state: State,
  originalContext: ApolloContext,
  meta: any
) => {
  return createProp(
    originalContext.client,
    // must add state suffix to make no duplicates to other entity name
    state.name + "State",
    () => {
      const rv = makeVar({} as any);
      const sm = getSessionManager(originalContext.client, false);
      const onChange = callbackGroup();

      const setValue = (nextValue: any) => {
        if (nextValue !== rv()) {
          rv(nextValue);
        }
      };

      rv.onNextChange(function listen(value) {
        onChange.invoke(value);
        rv.onNextChange(listen);
      });

      const recompute = () => {
        const newSession = sm.start();
        let nextValue: any;
        if (typeof state.initial === "function") {
          const nestedContext = createContext(
            originalContext,
            newSession,
            meta,
            false,
            () => sm.data
          );
          nextValue = (state.initial as Function)(nestedContext);
        } else {
          nextValue = state.initial;
        }
        sm.onLoad.invokeAndClear();
        setValue(nextValue);
      };

      sm.recompute = recompute;

      recompute();

      return {
        rv,
        get() {
          return rv();
        },
        set(value: any) {
          // setter
          const nextValue = getUpdatedData(value, rv);
          setValue(nextValue);
        },
        on(handlers: Record<string, any>) {
          const unsubscribe = callbackGroup();
          if (handlers.change) {
            unsubscribe(onChange(handlers.change));
          }
          return unsubscribe.invokeAndClear;
        },
      };
    }
  );
};

const createStateDispatcher = <TData>(
  originalContext: ApolloContext,
  state: State<TData>,
  session: Session,
  updatable: boolean,
  meta: any
) => {
  const { get, set, on, rv } = createState(state, originalContext, meta);

  return Object.assign(
    (...args: any[]) => {
      if (!args.length) {
        const value = get();

        if (session.manager.recompute) {
          session.manager.onLoad(() =>
            session.manager.onDispose(on({ change: session.manager.recompute }))
          );
        }
        return value;
      }

      if (!updatable) {
        throw new Error("Updating state in this context is not allowed");
      }
      set(args[0]);
    },
    { rv, next: rv.onNextChange }
  );
};

export { createStateDispatcher };
