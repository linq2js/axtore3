export type CallbackGroup = {
  /**
   * add callback into the group and return `remove` function
   * @param callback
   */
  (callback: Function): VoidFunction;
  called(): number;
  /**
   * call all callbacks with specified args
   * @param args
   */
  invoke(...args: any[]): void;
  /**
   * remove all callbacks
   */
  clear(): void;
  size(): number;
  clone(): CallbackGroup;
  invokeAndClear(...args: any[]): void;
};

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
    (callback: Function) => {
      callbacks.push(callback);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        const index = callbacks.indexOf(callback);
        if (index !== -1) callbacks.splice(index, 1);
      };
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
