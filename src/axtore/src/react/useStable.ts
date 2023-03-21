import { useRef, useState } from "react";

const useStable = <T extends Record<string | number | symbol, any>>(
  unstable: T
) => {
  const unstableRef = useRef(unstable);
  unstableRef.current = unstable;

  return useState(() => {
    const cache = new Map<any, Function>();
    const get = (_: any, prop: any) => {
      const value = unstableRef.current[prop];

      if (typeof value === "function") {
        let cachedFn = cache.get(prop);
        if (!cachedFn) {
          cachedFn = (...args: any[]) => unstableRef.current[prop](...args);
          cache.set(prop, cachedFn);
        }
        return cachedFn;
      }
      return value;
    };

    return new Proxy(
      {},
      {
        get,
        set(_, prop, value) {
          unstableRef.current[prop as keyof T] = value;
          return true;
        },
        ownKeys(_) {
          return Object.keys(unstableRef.current);
        },
        getOwnPropertyDescriptor(target, key) {
          return {
            value: get(target, key),
            enumerable: true,
            configurable: true,
          };
        },
      }
    ) as T;
  })[0];
};

export { useStable };
