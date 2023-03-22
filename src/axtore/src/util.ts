import {
  Atom,
  LazyResult,
  Mutation,
  ObjectType,
  Query,
  Store,
  TypeDef,
} from "./types";
import { DocumentNode, Kind } from "graphql";

const enqueue = Promise.resolve().then.bind(Promise.resolve());

const getType = (obj: any): ObjectType | "unknown" => {
  const type = String(obj?.type) as ObjectType;
  if (!type) return "unknown";
  return type;
};

const isQuery = <TVariables = any, TData = any>(
  obj: any
): obj is Query<TVariables, TData> => {
  return getType(obj) === "query";
};

const isStore = <TDefs>(obj: any): obj is Store<TDefs> => {
  return getType(obj) === "store";
};

const isMutation = <TVariables = any, TData = any>(
  obj: any
): obj is Mutation<TVariables, TData> => {
  return getType(obj) === "mutation";
};

const isLazy = <T>(obj: any): obj is LazyResult<T> => {
  return getType(obj) === "lazy";
};

const isAtom = <T>(obj: any): obj is Atom<T> => {
  return getType(obj) === "atom";
};

const isPromiseLike = <T>(value: any): value is Promise<T> => {
  return value && typeof value.then === "function";
};

const deferIf = <T>(enabled: boolean, callback: () => Promise<T>) => {
  if (!enabled) return callback();
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      callback().then(resolve, reject);
    }, 0);
  });
};

const noop = () => {};

const is = <T>(
  value: any,
  checker: (value: T | undefined) => unknown
): value is T => {
  return !!checker(value);
};

const forever = new Promise(noop);

/**
 * Type guard for function type. Use to narrow any value to `(...args: any[]) => any` type
 * @param obj
 * @returns
 */
const isFunction = (obj: any): obj is (...args: any[]) => any =>
  typeof obj === "function";

const createProp = <T = unknown>(
  obj: any,
  prop: any,
  valueFactory: () => T
) => {
  if (obj?.[prop]) return obj[prop] as T;
  return (obj[prop] = valueFactory());
};

const debounceMicroTask = (task: VoidFunction) => {
  let prevToken = {};

  return () => {
    const currentToken = (prevToken = {});

    enqueue(async () => {
      if (currentToken !== prevToken) return;
      task();
    });
  };
};

const delay = (ms: number = 0) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const documentType = (value?: DocumentNode) => value?.kind === Kind.DOCUMENT;

const typeDefType = (value?: TypeDef) =>
  typeof value !== "function" && typeof value?.name === "string";

export {
  getType,
  isLazy,
  isQuery,
  isMutation,
  isAtom,
  isPromiseLike,
  isFunction,
  isStore,
  noop,
  deferIf,
  is,
  delay,
  forever,
  createProp,
  enqueue,
  debounceMicroTask,
  documentType,
  typeDefType,
};
