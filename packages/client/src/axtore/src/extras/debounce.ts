import { ExtrasContext } from "../types";

const DEBOUNCE_PROP = Symbol("debounce");

const debounce = ({ data }: ExtrasContext, ms: number) => {
  const timer = data[DEBOUNCE_PROP];
  console.log(timer, ms);
  clearTimeout(timer);
  return new Promise((resolve) => {
    data[DEBOUNCE_PROP] = setTimeout(resolve, ms);
  });
};

export { debounce };
