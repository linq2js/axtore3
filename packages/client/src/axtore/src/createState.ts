import { generateName } from "./generateName";
import type { Model, State } from "./types";

const createState = <TContext, TMeta, TData>(
  model: Model<TContext, TMeta>,
  initial: TData | ((context: any) => TData),
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
