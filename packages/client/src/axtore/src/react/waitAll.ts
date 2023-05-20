import { isPromiseLike } from "../util";

const waitAll = <TAwaitables extends { wait(): any }[]>(
  ...awaitables: TAwaitables
): {
  [key in keyof TAwaitables]: TAwaitables[key] extends (...args: any[]) => any
    ? ReturnType<TAwaitables[key]>
    : never;
} => {
  let lastError: any;
  const promises: Promise<any>[] = [];
  const results = awaitables.map((awaitable) => {
    try {
      return awaitable.wait();
    } catch (ex) {
      if (isPromiseLike(ex)) {
        promises.push(ex);
      } else {
        lastError = ex;
      }
    }
  });

  // something went wrong
  if (lastError) {
    throw lastError;
  }

  // somethings are still loading
  if (promises.length) {
    // there might be an error when first promise is resolved, so we need to notify to the app asap that why we are using `race` instead of all
    throw Promise.race(promises);
  }

  // everything is loaded
  return results as any;
};

export { waitAll };
