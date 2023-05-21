import { generateName } from "./generateName";
import type { Model, NoInfer, State, StateOptions } from "./types";

const createState = <TContext, TMeta, TData>(
  model: Model<TContext, TMeta>,
  initial: TData | ((context: any) => TData),
  options: NoInfer<StateOptions<TData>> = {}
): State<TData> => {
  return {
    type: "state",
    options: {
      ...options,
      name: generateName("state", options.name),
    },
    model,
    initial,
  };
};

export { createState };
