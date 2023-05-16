import type { ObjectType } from "./types";

let id = 1;

const generateName = (type: ObjectType, key?: string) => {
  return key || `__${type}_${id++}`;
};

export { generateName };
