import { getEvent } from "./getEvent";
import { Client, Event, EventDispatcher } from "./types";

const createEventDispatcher = <TArgs>(
  client: Client,
  event: Event<TArgs>
): EventDispatcher<TArgs> => {
  return getEvent(client, event);
};

export { createEventDispatcher };
