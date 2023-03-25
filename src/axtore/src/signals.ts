import {
  Atom,
  Client,
  NoInfer,
  Query,
  Signal,
  ConditionalContext as SignalContext,
  VariablesArgs,
} from "./types";
import { forEach, isAtom, isQuery } from "./util";

import { callbackGroup } from "./callbackGroup";

export type ChangedSignal = {
  /**
   * create a signal that will be triggered whenever atom data has been changed
   * @param atom
   * @param args
   */
  <TData>(atom: Atom<TData>): Signal<{ data: TData; type: "atom" }>;

  /**
   * create a signal that will be triggered whenever query data has been changed
   * @param query
   * @param args
   */
  <TVariables, TData>(
    query: Query<TVariables, TData>,
    ...args: VariablesArgs<TVariables>
  ): Signal<{ data: TData; type: "query" }>;
};

export type EverySignal = {
  /**
   * create a signal that will be triggered every X milliseconds
   * @param ms
   */
  (ms: number): Signal;
};

export type SignalCondition<TContext> = (context: TContext) => boolean;

const changed: ChangedSignal = (input: any, ...args: any[]): Signal => {
  return (client, dispatch) => {
    if (isQuery(input)) {
      return input.use(client).subscribe({
        onChange(data) {
          dispatch({ data, type: "query" });
        },
        variables: args[0],
      });
    }

    if (isAtom(input)) {
      return input.use(client).subscribe({
        onChange(data) {
          dispatch({ data, type: "atom" });
        },
      });
    }

    throw new Error(`Invalid input. Expected query/atom but got ${input}`);
  };
};

const createSignalContext = <TContext>(client: Client): SignalContext => {
  return {
    client,
    get(input: any, ...args: any[]): any {
      if (isAtom(input)) {
        return input.use(client).get();
      }

      if (isQuery(input)) {
        const queryOptions = input.mergeOptions({ variables: args[0] as any });
        return client.readQuery(queryOptions);
      }

      throw new Error(
        `No overload for these arguments ${[input, ...args]} supported`
      );
    },
  };
};

const cond = <TContext = any>(
  condition: SignalCondition<SignalContext & TContext>,
  signals: Signal<TContext> | Signal<TContext>[]
): Signal<TContext> => {
  return (client, dispatch) => {
    const unsubscribe = callbackGroup();
    forEach(signals, (signal) => {
      signal(client, (context) => {
        const conditionalContext = {
          ...createSignalContext(client),
          ...context,
        };

        if (!condition(conditionalContext)) return;
        dispatch(context);
      });
    });
    return unsubscribe.invokeAndClear;
  };
};

const every: EverySignal = (ms: number): Signal => {
  return (_, action) => {
    const timer = setInterval(action, ms);

    return () => {
      clearInterval(timer);
    };
  };
};

const and = <TContext>(
  ...conditions: NoInfer<SignalCondition<TContext>[]>
): SignalCondition<TContext> => {
  return (context: TContext) =>
    conditions.every((condition) => condition(context));
};

const or = <TContext>(
  ...conditions: NoInfer<SignalCondition<TContext>[]>
): SignalCondition<TContext> => {
  return (context: TContext) =>
    conditions.some((condition) => condition(context));
};

export { changed, every, cond, and, or };
