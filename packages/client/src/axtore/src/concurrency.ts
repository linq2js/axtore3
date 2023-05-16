import { ConcurrencyOptions } from "./types";
import { createProp, forever } from "./util";

type ConcurrencyData = { data?: any };

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
    return new Promise<T>((resolve) => {
      concurrencyData.data = setTimeout(() => {
        fn().then(resolve);
      }, options.debounce);
    });
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
