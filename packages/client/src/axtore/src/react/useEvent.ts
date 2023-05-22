import { useApolloClient } from "@apollo/client";
import { useEffect, useMemo, useState } from "react";
import { getEvent } from "../getEvent";
import { Client, Event, EventDispatcher, NoInfer } from "../types";
import { useStable } from "./useStable";

export type UseEventOptions<TArgs> = {
  onFire?(args: TArgs): void;
  autoBind?: boolean;
  client?: Client;
};

export type EventDispatcherWrapper<TArgs> = Pick<
  EventDispatcher<TArgs>,
  "fireOnce" | "on" | "pause" | "resume" | "any"
> &
  EventDispatcher<TArgs>["fire"];

const useEvent = <TArgs>(
  event: Event<TArgs>,
  options: NoInfer<UseEventOptions<TArgs>> = {}
) => {
  const client = useApolloClient(options.client);
  const dispatcher = useMemo(() => getEvent(client, event), [event, client]);
  const { onFire } = useStable(options);
  const rerender = useState<any>()[1];

  useEffect(() => {
    if (!options.autoBind && !onFire) return;
    return dispatcher.on((args) => {
      onFire?.(args);
      if (options.autoBind) {
        rerender({});
      }
    });
  }, [dispatcher, onFire, options.autoBind, rerender]);

  return useMemo(() => {
    const fire = (...args: any[]) => {
      return (dispatcher.fire as Function)(...args);
    };

    Object.assign(fire, dispatcher);

    Object.defineProperties(fire, {
      paused: { get: dispatcher.paused },
      last: { get: dispatcher.last },
      fired: { get: dispatcher.fired },
    });

    return fire as unknown as EventDispatcherWrapper<TArgs>;
  }, [dispatcher]);
};

export { useEvent };
