import { createModel } from "./createModel";
import { Client, MetaBase, SkipFirst } from "./types";

const createModelDispatcher = <TMeta extends MetaBase>(
  client: Client,
  meta: TMeta
) => {
  const derivedModel = createModel().use(meta);
  const call = derivedModel.call;
  return (...args: SkipFirst<Parameters<typeof call>>) => call(client, ...args);
};

export { createModelDispatcher };
