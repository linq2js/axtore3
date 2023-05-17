import type { CallbackGroup } from "./types";

const callbackGroup = (
  callbacks: Function[] = [],
  called = 0
): CallbackGroup => {
  const clear = () => {
    callbacks.length = 0;
  };
  const clone = () => {
    return callbackGroup(callbacks.slice(), called);
  };
  const invoke = (...args: any[]) => {
    if (!callbacks.length) return;
    // optimize performance
    if (args.length > 2) {
      callbacks.slice().forEach((callback) => callback(...args));
    } else if (args.length === 2) {
      callbacks.slice().forEach((callback) => callback(args[0], args[1]));
    } else if (args.length === 1) {
      callbacks.slice().forEach((callback) => callback(args[0]));
    } else {
      callbacks.slice().forEach((callback) => callback());
    }
  };

  return Object.assign(
    (callback: Function, once: boolean = false) => {
      if (once) {
        const original = callback;
        callback = (...args: any[]) => {
          unsubscribe();
          return original(...args);
        };
      }

      callbacks.push(callback);
      let active = true;
      const unsubscribe = () => {
        if (!active) return;
        active = false;
        const index = callbacks.indexOf(callback);
        if (index !== -1) callbacks.splice(index, 1);
      };

      return unsubscribe;
    },
    {
      size: () => callbacks.length,
      called: () => called,
      clear,
      invoke,
      invokeAndClear(...args: any[]) {
        invoke(...args);
        clear();
      },
      clone,
    }
  );
};

export { callbackGroup };
