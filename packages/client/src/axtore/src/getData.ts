import equal from "@wry/equality";
import { createProp } from "./util";

const getData = <P, S, R extends { key: S }>(
  storage: any,
  pk: P,
  sk: S,
  factory: (pk: P, sk: S) => R
) => {
  const groups = createProp(
    storage,
    "sharedData",
    () => new WeakMap<any, R[]>()
  );

  let list = pk ? groups.get(pk) : undefined;

  if (pk && !list) {
    list = [];
    groups.set(pk, list);
  }

  let item = list?.find((x) => equal(x.key, sk));
  if (!item) {
    item = factory(pk, sk);
    list?.push(item);
  }
  return item;
};

export { getData };
