import { Event, Model } from "./types";

const createEvent = <TData>(
  model: Model<any, any>,
  name: string
): Event<TData> => {
  return {
    type: "event",
    name,
    model,
  };
};

export { createEvent };
