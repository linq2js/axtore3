import { LazyFactory } from "./types";

const createLazy: LazyFactory = (...args: any[]) => {
  // lazy(loader, options)
  if (typeof args[0] === "function") {
    return {
      type: "lazy",
      data: args[0],
      loader: args[0],
      options: args[1] || {},
    };
  }
  // lazy(data, loader, options)
  return {
    type: "lazy",
    data: () => args[0],
    loader: args[1],
    options: args[2] || {},
  };
};

export { createLazy };
