import { Event, Model } from "./types";

const createEvent = <TData>(
  model: Model<any, any>,
  name: string
): Event<TData> => {
  return {
    __type: "event" as const,
    name,
    model,
  };
};

export { createEvent };
