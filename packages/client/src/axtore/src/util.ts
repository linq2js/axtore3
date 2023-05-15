import { State, LoadableSource, Mutation, ObjectType, Query } from "./types";
import { gql as originalGql } from "graphql-tag";
import {
  DefinitionNode,
  DocumentNode,
  FragmentDefinitionNode,
  Kind,
  OperationDefinitionNode,
  OperationTypeNode,
  TypedQueryDocumentNode,
} from "graphql";

const enqueue = Promise.resolve().then.bind(Promise.resolve());

const getType = (obj: any): ObjectType | "unknown" => {
  const type = String(obj?.type) as ObjectType;
  if (!type) return "unknown";
  return type;
};

const isQuery = <TVariables = {} | undefined, TData = any>(
  obj: any
): obj is Query<TVariables, TData> => {
  return getType(obj) === "query";
};

const isMutation = <TVariables = {} | undefined, TData = any>(
  obj: any
): obj is Mutation<TVariables, TData> => {
  return getType(obj) === "mutation";
};

const isState = <T>(obj: any): obj is State<T> => {
  return getType(obj) === "state";
};

const isLoadable = <T>(obj: any): obj is LoadableSource<T> => {
  return getType(obj) === "loadable";
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

const selectDefinition = (
  source: DocumentNode,
  type: OperationTypeNode,
  name: string
): DocumentNode => {
  const operationDefinitions: OperationDefinitionNode[] = [];
  const otherDefinitions: DefinitionNode[] = [];
  const fragmentDefinitions: FragmentDefinitionNode[] = [];

  source.definitions.forEach((definitionNode) => {
    if (definitionNode.kind === Kind.OPERATION_DEFINITION) {
      operationDefinitions.push(definitionNode);
    } else if (definitionNode.kind === Kind.FRAGMENT_DEFINITION) {
      fragmentDefinitions.push(definitionNode);
    } else {
      otherDefinitions.push(definitionNode);
    }
  });

  const operationDefinition = operationDefinitions.find(
    (x) => x.operation === type && x.name?.value === name
  );

  if (!operationDefinition) {
    throw new Error(`No ${type} named '${name}' found`);
  }

  const documentNode: DocumentNode = {
    kind: Kind.DOCUMENT,
    definitions: [operationDefinition],
  };
  const documentString = JSON.stringify(documentNode);
  const usedFragmentDefinitions: FragmentDefinitionNode[] = [];

  fragmentDefinitions.forEach((fragmentDefinition) => {
    const testString = `{"kind":"FragmentSpread","name":{"kind":"Name","value":"${fragmentDefinition.name.value}"}`;
    if (documentString.includes(testString)) {
      usedFragmentDefinitions.push(fragmentDefinition);
    }
  });

  if (usedFragmentDefinitions.length) {
    return {
      kind: Kind.DOCUMENT,
      definitions: [operationDefinition, ...usedFragmentDefinitions],
    };
  }

  return documentNode;
};

const forEach = <T>(
  values: T | T[],
  callback: (value: T, index: number) => void
) => {
  return (Array.isArray(values) ? values : [values]).forEach(callback);
};

const typed = <TVariables, TData>(document: DocumentNode) =>
  document as TypedQueryDocumentNode<TData, TVariables>;

const gql = <TVariables = any, TData = any>(
  ...args: Parameters<typeof originalGql>
) => originalGql(...args) as TypedQueryDocumentNode<TData, TVariables>;

const untilSubscriptionNotifyingDone = () => delay(0);

export {
  getType,
  isQuery,
  isMutation,
  isState,
  isPromiseLike,
  isFunction,
  isLoadable,
  noop,
  deferIf,
  is,
  delay,
  forever,
  createProp,
  enqueue,
  debounceMicroTask,
  documentType,
  selectDefinition,
  forEach,
  gql,
  typed,
  untilSubscriptionNotifyingDone,
};
