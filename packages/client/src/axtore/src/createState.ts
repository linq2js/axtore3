import { generateName } from "./generateName";
import { Model, State, StateContext } from "./types";

const createState = <TContext, TMeta, TData>(
  model: Model<TContext, TMeta>,
  initial: TData | ((context: StateContext<any, any>) => TData),
  name?: string
): State<TData> => {
  const id = generateName("state", name);
  return {
    type: "state",
    name: id,
    model,
    initial,
  };
};

export { createState };
