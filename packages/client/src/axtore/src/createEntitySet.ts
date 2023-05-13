import equal from "@wry/equality";
import { isFunction } from "./util";

export type EntitySet<K = unknown, V = unknown> = {
  get(key: K): V | undefined;
  get(key: K, create: () => V): V;
  set(key: K, value: V): void;
  /**
   * return true if value added successfully
   * return false if there is a value with the same key
   * @param key
   * @param create
   */
  add(key: K, create: () => V): boolean;
  delete(key: K): void;
  forEach(callback: (value: V, key: K) => any): void;
};

const NOT_FOUND = [-1, undefined] as const;

const createEntitySet = <V = unknown, K = unknown>(): EntitySet<K, V> => {
  type Item = { key: K; value: V };
  const items: Item[] = [];

  const findIndex = (key: K): readonly [number, Item | undefined] => {
    const index = items.findIndex((x) => equal(x.key, key));
    if (index === -1) return NOT_FOUND;
    return [index, items[index]] as const;
  };

  return {
    get(key, create?): any {
      const [, item] = findIndex(key);
      if (!item) {
        if (isFunction(create)) {
          const newItem = { key, value: create() };
          items.push(newItem);
          return newItem.value;
        }
        return undefined;
      }
      return item.value;
    },
    delete(key: K) {
      const [index] = findIndex(key);
      if (index === -1) return;
      items.splice(index, 1);
    },
    add(key, create) {
      const [, item] = findIndex(key);
      if (item) return false;
      items.push({ key, value: create() });
      return true;
    },
    set(key: K, value: V) {
      const [, item] = findIndex(key);
      if (item) {
        item.value = value;
      } else {
        items.push({ key, value });
      }
    },
    forEach(callback) {
      items.some(({ key, value }) => {
        const result = callback(value, key);
        if (result === false) return true;
        return false;
      });
    },
  };
};

export { createEntitySet };
