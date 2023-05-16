import type { ConcurrencyOptions } from "./types";
import { createProp, forever } from "./util";

type ConcurrencyData = {
  data?: any;
  promise?: Promise<any>;
  resolve?: (value: any) => void;
  reject?: (value: any) => void;
};

const CONCURRENCY_PROP = Symbol("concurrency");

const concurrency = <T>(
  context: any,
  options: ConcurrencyOptions,
  fn: () => Promise<T>
) => {
  const concurrencyData = createProp<ConcurrencyData>(
    context,
    CONCURRENCY_PROP,
    () => ({})
  );

  if (options.debounce) {
    clearTimeout(concurrencyData.data);

    concurrencyData.data = setTimeout(() => {
      const resolve = concurrencyData.resolve;
      const reject = concurrencyData.reject;
      delete concurrencyData.promise;
      delete concurrencyData.resolve;
      fn().then(resolve, reject);
    }, options.debounce);

    if (!concurrencyData.promise) {
      concurrencyData.promise = new Promise((resolve, reject) => {
        Object.assign(concurrencyData, { resolve, reject });
      });
    }

    return concurrencyData.promise;
  }
  if (options.throttle) {
    const lastExecution = (concurrencyData.data as number) ?? 0;
    const nextExecution = lastExecution + options.throttle;
    if (nextExecution <= Date.now()) {
      concurrencyData.data = Date.now();

      return fn();
    }
    return forever;
  }
  return fn();
};

export { concurrency };
