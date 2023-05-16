import { makeVar } from "@apollo/client";
import { callbackGroup } from "./callbackGroup";
import { createContext } from "./createContext";
import { getSessionManager } from "./getSessionManager";
import { getUpdatedData } from "./getUpdatedData";
import { ApolloContext, Session, State } from "./types";
import { createProp } from "./util";

const createStateDispatcher = <TData>(
  originalContext: ApolloContext,
  state: State<TData>,
  session: Session,
  updatable: boolean,
  meta: any,
  recomputeDerivedState?: VoidFunction
) => {
  const { get, set, on, rv } = createProp(
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
            updatable,
            undefined,
            recompute,
            () => sm.data
          );
          nextValue = (state.initial as Function)(nestedContext);
        } else {
          nextValue = state.initial;
        }
        sm.onLoad.invokeAndClear();
        setValue(nextValue);
      };

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

  return Object.assign(
    (...args: any[]) => {
      if (!args.length) {
        const value = get();
        if (recomputeDerivedState) {
          session.manager.onLoad(() =>
            session.manager.onDispose(on({ change: recomputeDerivedState }))
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
