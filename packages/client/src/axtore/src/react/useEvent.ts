import { useApolloClient } from "@apollo/client";
import { useEffect, useMemo, useState } from "react";
import { getEvent } from "../getEvent";
import { Event, NoInfer } from "../types";
import { useStable } from "./useStable";

export type UseEventOptions<TArgs> = {
  onFire?(args: TArgs): void;
  autoBind?: boolean;
};

const useEvent = <TArgs>(
  event: Event<TArgs>,
  options: NoInfer<UseEventOptions<TArgs>> = {}
) => {
  const client = useApolloClient();
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
    return {
      ...dispatcher,
      get paused() {
        return dispatcher.paused();
      },
      get last() {
        return dispatcher.last();
      },
      get fired() {
        return dispatcher.fired();
      },
    };
  }, [dispatcher]);
};

export { useEvent };
