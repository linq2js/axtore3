import { callbackGroup } from "./callbackGroup";

const all = (...targets: any[]) => {
  const cancel = callbackGroup();
  let cancelled = false;
  cancel(() => {
    cancelled = true;
  });

  return Object.assign(
    Promise.all(
      targets.map((target) => {
        if (typeof target === "function") {
          const promise = Promise.resolve(target(cancel));

          target = new Promise((resolve, reject) => {
            promise.then(
              (value) => {
                if (cancelled) return;
                resolve(value);
              },
              (error) => {
                if (cancelled) return;
                reject(error);
              }
            );
          });
        }
        // support cancellable promise
        if (typeof target?.cancel === "function") {
          cancel(() => target.cancel());
        }
        return target;
      })
    )
      .catch((error) => {
        cancel.invoke();
        throw error;
      })
      .finally(() => {
        cancel.clear();
      }),
    { cancel: cancel.invokeAndClear }
  );
};

const race = (...targets: any[]) => {
  const cancel = callbackGroup();
  return Object.assign(
    Promise.race(
      targets.map((target) => {
        if (typeof target === "function") {
          target = target(cancel);
        }
        return target;
      })
    ).finally(() => {
      cancel.invokeAndClear();
    }),
    { cancel: cancel.invokeAndClear }
  );
};

export { all, race };
