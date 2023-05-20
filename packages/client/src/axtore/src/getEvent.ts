import { Client, Event } from "./types";
import { createProp } from "./util";

const EMPTY = {};

const getEvent = <TArgs = any>(client: Client, event: Event<TArgs>) => {
  event.model.init(client);

  return createProp(client, event.name, () => {
    let last: any = EMPTY;
    let resolve: undefined | ((data: TArgs) => void);
    let promise: Promise<TArgs> | undefined;
    let firedOnce = false;
    let paused = false;

    const next = () => {
      if (!promise) {
        promise = new Promise<TArgs>((r) => {
          resolve = r;
        });
      }
      return promise;
    };

    const fire = async (args: TArgs) => {
      if (firedOnce || paused) return;

      last = args;
      // resolve promise
      if (resolve) resolve(last);
      promise = undefined;
      // re-create promise
      next();
    };

    return Object.assign(next, {
      last(): TArgs | undefined {
        return last === EMPTY ? undefined : last;
      },
      /**
       * return last data if any or wait for next trigger
       */
      any() {
        if (last === EMPTY) return next();
        return Promise.resolve(last as TArgs);
      },
      paused() {
        return paused;
      },
      pause() {
        paused = true;
      },
      resume() {
        paused = false;
      },
      fire,
      fired() {
        return last !== EMPTY;
      },
      async fireOnce(args: TArgs) {
        if (firedOnce || paused) return;
        const result = fire(args);
        firedOnce = true;
        return result;
      },
      on(listener: (args: TArgs) => void) {
        let unsubscribed = false;

        const listen = async () => {
          while (true) {
            const args = await next();
            if (unsubscribed) return;
            listener(args);
          }
        };

        listen();

        return () => {
          unsubscribed = true;
        };
      },
    });
  });
};

export { getEvent };
