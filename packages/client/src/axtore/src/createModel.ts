import {
  ApolloContext,
  StateContext,
  State,
  Client,
  CreateModel,
  CustomContextFactory,
  FieldResolver,
  Model,
  ModelOptions,
  Mutation,
  Query,
  QueryOptions,
  RootResolver,
  UpdateRecipe,
  Effect,
  MutationOptions,
} from "./types";
import {
  DocumentNode,
  Kind,
  ObjectValueNode,
  OperationDefinitionNode,
  visit,
} from "graphql";
import {
  ApolloQueryResult,
  FetchResult,
  makeVar,
  ObservableQuery,
} from "@apollo/client";
import {
  createProp,
  isState,
  isMutation,
  isQuery,
  untilSubscriptionNotifyingDone,
} from "./util";

import { generateName } from "./generateName";
import gql from "graphql-tag";
import { getQueryDefinition, mergeDeep } from "@apollo/client/utilities";
import { CallbackGroup, callbackGroup } from "./callbackGroup";
import produce from "immer";
import { getData } from "./getData";

type FieldMappings = Record<
  string,
  Record<string, { field: string; type?: string }>
>;

type QueryInfo = {
  query: Query;
  observable: ObservableQuery;
};

const createQuery = <TVariables, TData>(
  model: Model<any, any>,
  name: string,
  document: DocumentNode,
  resolver?: RootResolver<any, TVariables, TData>,
  dataType?: string
): Query<TVariables, TData> => {
  return {
    type: "query",
    name,
    model,
    document,
    resolver,
    dataType,
    mergeOptions(newOptions) {
      return {
        ...newOptions,
        query: document,
        variables: wrapVariables(!!resolver, newOptions?.variables),
      };
    },
  };
};

const createMutation = <TContext, TMeta, TVariables, TData>(
  model: Model<TContext, TMeta>,
  name: string,
  document: DocumentNode,
  resolver?: RootResolver<any, TVariables, TData>,
  dataType?: string
): Mutation<TVariables, TData> => {
  return {
    type: "mutation",
    name,
    model,
    document,
    resolver,
    dataType,
    mergeOptions(newOptions) {
      return {
        ...newOptions,
        mutation: document,
        variables: wrapVariables(!!resolver, newOptions?.variables),
      };
    },
  };
};

const createState = <TContext, TMeta, TData>(
  model: Model<TContext, TMeta>,
  initial: TData | ((context: StateContext<any, any>) => TData),
  name?: string
): State<TData> => {
  const id = generateName("state", name);
  return {
    type: "state",
    name: id,
    model,
    initial,
  };
};

const ENABLE_HARD_REFETCH = Symbol("hardRefetch");

const WRAPPED_VARIABLE_NAME = "__VARS__";

const createModel: CreateModel = (options = {}) => {
  return createModelInternal(options);
};

const createDynamicDocument = (
  type: "query" | "mutation",
  field: string,
  alias: string
) => {
  const selection = `($${WRAPPED_VARIABLE_NAME}: ${WRAPPED_VARIABLE_NAME}) {
      ${alias}:${field} (${WRAPPED_VARIABLE_NAME}: $${WRAPPED_VARIABLE_NAME}) @client
    }`;

  return gql`
    ${type}
    ${selection}
  `;
};

const patchTypeIfPossible = <T>(data: T, typeName?: string): T => {
  if (!typeName) return data;

  if (Array.isArray(data)) {
    return data.map((item) => patchTypeIfPossible(item, typeName)) as any;
  }

  if (data !== null && typeof data !== "undefined") {
    return { ...data, __typename: typeName };
  }

  return data;
};

const createModelInternal = <TContext, TMeta extends Record<string, any>>(
  modelOptions: ModelOptions<TContext>,
  meta: TMeta = {} as any,
  effects: Effect<TContext, TMeta>[] = [],
  fieldMappings: FieldMappings = {}
): Model<TContext, TMeta> => {
  const modelId = Symbol("model");
  const contextFactory: CustomContextFactory<TContext> =
    typeof modelOptions.context === "function"
      ? (modelOptions.context as CustomContextFactory<TContext>)
      : () => (modelOptions.context ?? {}) as unknown as TContext;

  const init = (client: Client) => {
    // already init for this client
    if ((client as any)[modelId]) {
      return;
    }

    (client as any)[modelId] = true;

    let resolvers: any = {};
    let hasNewResolver = false;

    Object.entries(meta).forEach(([typeName, value]) => {
      // do nothing with state
      if (isState(value)) {
        return;
      }

      if (isQuery(value)) {
        if (value.model !== model) {
          value.model.init(client);
          return;
        }
        if (!value.resolver) return;

        hasNewResolver = true;
        resolvers = {
          ...resolvers,
          Query: {
            [value.name]: async (
              _: any,
              args: any,
              apolloContext: ApolloContext
            ) => {
              args = unwrapVariables(args);
              const sessionManager = getSessionManager(
                client,
                value.document,
                args
              );
              const session = sessionManager.start();
              const context = createContext(
                apolloContext,
                session,
                meta,
                false,
                () => ({
                  query: value,
                  observable: sessionManager.observableQuery,
                }),
                undefined,
                () => sessionManager.data
              );
              const data = await value.resolver?.(args, context);
              sessionManager.onLoad.invokeAndClear();

              if (value.dataType) {
                return patchTypeIfPossible(data, value.dataType);
              }
              return data;
            },
          },
        };
        return;
      }

      if (isMutation(value)) {
        if (value.model !== model) {
          value.model.init(client);
          return;
        }
        if (!value.resolver) return;
        hasNewResolver = true;
        resolvers = {
          ...resolvers,
          Mutation: {
            [value.name]: async (
              _: any,
              args: any,
              apolloContext: ApolloContext
            ) => {
              args = unwrapVariables(args);
              const session = getSessionManager(client, false).start();
              const context = createContext(
                apolloContext,
                session,
                meta,
                true,
                undefined,
                undefined,
                () =>
                  // create simple data object for mutation
                  getData(client, value, {}, (_, key) => ({ key }))
              );
              const data = await value.resolver?.(args, context);
              if (value.dataType) {
                return patchTypeIfPossible(data, value.dataType);
              }
              return data;
            },
          },
        };
        return;
      }

      // is type resolvers
      Object.entries(value).forEach(
        ([resolverName, resolver]: [string, any]) => {
          if (resolver.model !== model) {
            resolver.model.init(client);
            return;
          }

          hasNewResolver = true;
          resolvers = {
            ...resolvers,
            [typeName]: {
              ...resolvers[typeName],
              [resolverName]: (
                value: any,
                args: any,
                apolloContext: ApolloContext
              ) => {
                args = unwrapVariables(args);
                const session = getSessionManager(client, false).start();
                const context = createContext(
                  apolloContext,
                  session,
                  meta,
                  false
                );
                return resolver(value, args, context);
              },
            },
          };
        }
      );
    });

    if (hasNewResolver) {
      client.addResolvers(resolvers);
    }

    // execute effects
    if (effects.length) {
      call(client, (context: any) => {
        // make sure do not run an effect twice
        new Set(effects).forEach((effect) => effect(context));
      });
    }
  };

  const extend = (
    prop: string,
    metaItem: any,
    newFieldMappings?: FieldMappings
  ) => {
    const newModel = createModelInternal(
      modelOptions,
      {
        ...meta,
        [prop]: metaItem,
      },
      effects,
      newFieldMappings
        ? mergeDeep(fieldMappings, newFieldMappings)
        : fieldMappings
    );
    Object.assign(metaItem, { model: newModel });
    return newModel;
  };

  const call = (client: Client, action: Function, ...args: any[]) => {
    init(client);

    const context = createContext(
      {
        client,
        ...contextFactory({ client }),
      },
      getSessionManager(client).start(),
      meta,
      true
    );
    return action(context, ...args);
  };

  const model: Model<TContext, TMeta> = {
    meta,
    effects,
    init,
    use(newMeta) {
      return createModelInternal(
        modelOptions,
        { ...meta, ...newMeta },
        effects as any,
        fieldMappings
      );
    },
    query(selection: string, ...args: any[]) {
      const [alias, name = alias] = selection.split(":");
      let document: DocumentNode;
      let resolver: RootResolver<TContext, any, any> | undefined;
      let options: QueryOptions | undefined;
      let newFieldMappings: FieldMappings | undefined;
      // is resolver
      if (typeof args[0] === "function") {
        document = createDynamicDocument("query", name, alias);
        resolver = args[0];
        options = args[1];
        newFieldMappings = {
          ROOT: {
            [alias]: {
              field: name,
              type: options?.type,
            },
          },
        };
      } else {
        document = patchLocalFields(args[0], fieldMappings);
        options = args[1];
      }
      const { type } = options ?? {};
      return extend(
        alias,
        createQuery(model, name, document, resolver, type),
        newFieldMappings
      );
    },
    mutation(selection, ...args: any[]) {
      const [alias, name = alias] = selection.split(":");
      let options: MutationOptions | undefined;
      let newFieldMappings: FieldMappings | undefined;

      let document: DocumentNode;
      let resolver: RootResolver<TContext, any, any> | undefined;

      // is resolver
      if (typeof args[0] === "function") {
        document = createDynamicDocument("mutation", name, alias);
        resolver = args[0];
        options = args[1];
        newFieldMappings = {
          ROOT: {
            [alias]: {
              field: name,
              type: options?.type,
            },
          },
        };
      } else {
        document = patchLocalFields(args[0], fieldMappings);
      }
      return extend(
        alias,
        createMutation(model, name, document, resolver),
        fieldMappings
      );
    },
    state(name, initial, options) {
      return extend(name, createState(model, initial, options?.name));
    },
    effect(...newEffects) {
      effects.push(...newEffects);
      return this;
    },
    type(name, resolvers) {
      const resolverWrappers: Function[] = [];
      const newFieldMappings: FieldMappings = {};

      const newModel = createModelInternal(
        modelOptions,
        mergeDeep(meta, {
          // assign model
          [name]: Object.entries(resolvers).reduce((prev, [key, value]) => {
            const [dataType, resolver] = Array.isArray(value)
              ? value
              : [undefined, value];

            newFieldMappings[name] = {
              ...newFieldMappings[name],
              [key]: { field: key, type: dataType },
            };

            const resolverWrapper = Object.assign(
              async (...args: Parameters<FieldResolver<any, any>>) => {
                const result = await resolver(...args);
                return patchTypeIfPossible(result, dataType);
              },
              { dataType }
            );

            resolverWrappers.push(resolverWrapper);
            return {
              ...prev,
              [key]: resolverWrapper,
            };
          }, {}),
        }),
        effects,
        mergeDeep(fieldMappings, newFieldMappings)
      );

      resolverWrappers.forEach((x) => Object.assign(x, { model: newModel }));

      return newModel;
    },
    call,
  };

  return model;
};

type SessionManager = {
  readonly key: any;
  /**
   * this uses for query session only
   */
  readonly observableQuery: ObservableQuery;
  readonly data: any;
  start(): Session;
  onLoad: CallbackGroup;
  onDispose: CallbackGroup;
  evict(): void;
  refetch(): Promise<ApolloQueryResult<any>>;
};

type Session = {
  readonly isActive: boolean;
  readonly manager: SessionManager;
};

const getSessionManager = (client: Client, group: any = {}, key: any = {}) => {
  return getData(client, group, key, () => {
    let currentToken = {};
    const data = {};
    const onDispose = callbackGroup();
    const onLoad = callbackGroup();
    let observableQuery: ObservableQuery | undefined;

    const sessionManager: SessionManager = {
      key,
      onDispose,
      onLoad,
      data,
      get observableQuery() {
        if (!observableQuery) {
          observableQuery = client.watchQuery({
            query: group,
            variables: key,
            notifyOnNetworkStatusChange: true,
          });
        }
        return observableQuery;
      },
      evict() {
        onDispose.invokeAndClear();
        onLoad.invokeAndClear();
      },
      refetch() {
        onDispose.invokeAndClear();
        onLoad.invokeAndClear();
        return sessionManager.observableQuery.refetch();
      },
      start() {
        let token = (currentToken = {});
        // cleanup previous session
        onDispose.invokeAndClear();
        onLoad.invokeAndClear();

        return {
          get isActive() {
            return token === currentToken;
          },
          manager: sessionManager,
          onDispose,
        };
      },
    };
    return sessionManager;
  });
};

const handleFetchResult = <T>(result: FetchResult<T>) => {
  if (result.errors?.length) throw result.errors[0];
  return result.data;
};

const getUpdatedData = <T>(
  recipe: UpdateRecipe<T>,
  getPrevData: () => T | undefined | null
) => {
  if (typeof recipe === "function") {
    let prevData = getPrevData();
    if (prevData === null) {
      prevData = undefined;
    }

    return produce(prevData, recipe as (prevData: T) => T) as T;
  }
  return recipe;
};

const createStateDispatcher = <TData>(
  originalContext: ApolloContext,
  state: State<TData>,
  session: Session,
  updatable: boolean,
  meta: any,
  recomputeDerivedState?: VoidFunction
) => {
  const { get, set, on, rv } = createProp(
    originalContext.client,
    // must add state suffix to make no duplicates to other entity name
    state.name + "State",
    () => {
      const rv = makeVar({} as any);
      const sm = getSessionManager(originalContext.client, false);

      const setValue = (nextValue: any) => {
        if (nextValue !== rv()) {
          rv(nextValue);
        }
      };

      const recompute = () => {
        const newSession = sm.start();
        let nextValue: any;
        if (typeof state.initial === "function") {
          const nestedContext = createContext(
            originalContext,
            newSession,
            meta,
            updatable,
            undefined,
            recompute,
            () => sm.data
          );
          nextValue = (state.initial as Function)(nestedContext);
        } else {
          nextValue = state.initial;
        }
        sm.onLoad.invokeAndClear();
        setValue(nextValue);
      };

      recompute();

      return {
        rv,
        get() {
          return rv();
        },
        set(value: any) {
          // setter
          const nextValue = getUpdatedData(value, rv);
          setValue(nextValue);
        },
        on(handlers: Record<string, any>) {
          const unsubscribe = callbackGroup();
          if (handlers.change) {
            unsubscribe(rv.onNextChange(handlers.change));
          }
          return unsubscribe.invokeAndClear;
        },
      };
    }
  );

  return Object.assign(
    (...args: any[]) => {
      if (!args.length) {
        const value = get();
        if (recomputeDerivedState) {
          session.manager.onLoad(() =>
            session.manager.onDispose(on({ change: recomputeDerivedState }))
          );
        }
        return value;
      }
      if (!updatable) {
        throw new Error("Updating state in this context is not allowed");
      }
      set(args[0]);
    },
    { rv, next: rv.onNextChange }
  );
};

const getObservableQuery = (
  client: Client,
  query: Query,
  variables: any = {}
) => {
  return getSessionManager(
    client,
    query.document,
    query.mergeOptions({ variables }).variables
  ).observableQuery;
};

const subscribeQueryChangeEvent = (
  observableQuery: ObservableQuery,
  callback: (result: ApolloQueryResult<any>) => void,
  once: boolean
) => {
  let prevData = observableQuery.getCurrentResult().data;
  const subscription = observableQuery.subscribe((result) => {
    if (
      result.error ||
      result.loading ||
      prevData === observableQuery.getCurrentResult().data
    ) {
      return;
    }
    if (once) subscription.unsubscribe();
    callback(result);
  });
  return () => subscription.unsubscribe();
};

const evictQuery = (client: Client, query: Query, variables: any = {}) => {
  const options = query.mergeOptions({ variables });
  const data = client.readQuery(options);
  if (data) {
    const definition = getQueryDefinition(query.document);
    definition.selectionSet.selections.forEach((x) => {
      if (x.kind !== Kind.FIELD) return;
      client.cache.evict({
        id: "ROOT_QUERY",
        fieldName: x.name.value,
        // broadcast: true,
        args: options.variables,
      });
    });
    client.cache.gc();
  }
};

const createQueryDispatcher = <TVariables, TData>(
  client: Client,
  query: Query<TVariables, TData>,
  session: Session,
  contextProxy: any,
  getContextData: () => any,
  getDerivedQuery?: () => QueryInfo
) => {
  const fetch = async (variables: any, noCache: boolean = false) => {
    const oq = getObservableQuery(client, query, variables);

    if (noCache) {
      return handleFetchResult(await oq.refetch());
    }

    return handleFetchResult(await oq.result());
  };

  return Object.assign(
    async (variables: any) => {
      const data = await fetch(variables);
      if (getDerivedQuery && session.isActive) {
        session.manager.onLoad(() => {
          const oq = getSessionManager(
            client,
            query.document,
            variables
          ).observableQuery;
          session.manager.onDispose(
            subscribeQueryChangeEvent(
              oq,
              () => {
                if (session.isActive) {
                  const qi = getDerivedQuery();
                  if (getContextData?.()?.[ENABLE_HARD_REFETCH]) {
                    evictQuery(client, qi.query, variables);
                    return;
                  }

                  qi.observable.refetch();
                }
              },
              true
            )
          );
        });
      }
      return data;
    },
    {
      evict(variables: any) {
        return evictQuery(client, query, variables);
      },
      resolve(variables: any) {
        // call query resolver directly if possible
        if (query.resolver) {
          return query.resolver(variables, contextProxy);
        }
        // unless call query with no-cache fetchPolicy
        return fetch(variables, true);
      },
      async refetch(variables: any = {}) {
        return handleFetchResult(
          await getSessionManager(client, query.document, variables).refetch()
        );
      },
      on(handlers: Record<string, Function>, variables: any) {
        const unsubscribe = callbackGroup();

        if (handlers.change) {
          const oq = getObservableQuery(client, query, variables);
          unsubscribe(
            subscribeQueryChangeEvent(
              oq,
              (result) => handlers.change(result.data),
              false
            )
          );
        }
        return unsubscribe.invokeAndClear;
      },
      called(variables: any) {
        const oq = getObservableQuery(client, query, variables);
        return !!oq.getLastResult();
      },
      data(variables: any) {
        const oq = getObservableQuery(client, query, variables);
        return oq.getLastResult()?.data;
      },
      async set(recipe: any, variables: any = {}) {
        const options = query.mergeOptions({ variables });
        let updatedData: any;

        if (typeof recipe === "function") {
          // recipe function needs previous data so skip update if query is not fetched
          const prevData = client.readQuery(options);
          if (!prevData) return;
          updatedData = produce(prevData, recipe);
        } else {
          updatedData = patchTypeIfPossible(recipe, query.dataType);
        }
        // no data
        if (!updatedData) return;

        client.writeQuery({
          ...options,
          data: updatedData,
          broadcast: true,
          overwrite: true,
        });

        await untilSubscriptionNotifyingDone();
      },
    }
  );
};

const createMutationDispatcher = <TVariables, TData>(
  client: Client,
  mutation: Mutation<TVariables, TData>,
  contextProxy: any
) => {
  const fetch = async (variables: any) => {
    return handleFetchResult(
      await client.mutate({
        mutation: mutation.document,
        variables: wrapVariables(!!mutation.resolver, variables),
      })
    );
  };

  return Object.assign(fetch, {
    resolve(variables: any) {
      if (mutation.resolver) {
        return mutation.resolver(variables, contextProxy);
      }
      return fetch(variables);
    },
  });
};

const createContext = (
  originalContext: ApolloContext,
  session: Session,
  meta: any,
  updatable: boolean,
  getDerivedQuery?: () => QueryInfo,
  recomputeDerivedState?: VoidFunction,
  getSharedData?: () => any
) => {
  let data: any;
  const use = (extras: Function, ...args: any[]) =>
    extras(contextProxy, ...args);
  const resolvedProps = new Map<any, any>([
    ["use", use],
    ["context", originalContext],
    ["client", originalContext.client],
  ]);
  const contextProxy = new Proxy(
    {},
    {
      get(_, p) {
        if (p === "data") {
          if (!data) {
            data = getSharedData ? getSharedData() : {};
          }
          return data;
        }

        if (resolvedProps.has(p)) {
          return resolvedProps.get(p);
        }

        // query/mutation dispatcher
        if (typeof p === "string" && p[0] === "$" && p.slice(1) in meta) {
          const value = meta[p.slice(1)];

          if (isQuery(value)) {
            const dispatcher = createQueryDispatcher(
              originalContext.client,
              value,
              session,
              contextProxy,
              () => data,
              getDerivedQuery
            );
            resolvedProps.set(p, dispatcher);
            return dispatcher;
          }

          if (isMutation(value)) {
            const dispatcher = createMutationDispatcher(
              originalContext.client,
              value,
              contextProxy
            );
            resolvedProps.set(p, dispatcher);
            return dispatcher;
          }

          if (isState(value)) {
            const dispatcher = createStateDispatcher(
              originalContext,
              value,
              session,
              updatable,
              meta,
              recomputeDerivedState ??
                (getDerivedQuery &&
                  (() => {
                    const qi = getDerivedQuery();
                    if (data?.[ENABLE_HARD_REFETCH]) {
                      evictQuery(
                        originalContext.client,
                        qi.query,
                        qi.observable.variables
                      );
                      return;
                    }
                    qi.observable.refetch();
                    console.log("vars", qi.observable.variables);
                  }))
            );
            resolvedProps.set(p, dispatcher);
            return dispatcher;
          }
        }

        if (p in originalContext) {
          const value = (originalContext as any)[p];
          resolvedProps.set(p, value);
          return value;
        }

        throw new Error(`Unknown prop ${p as any}`);
      },
    }
  ) as any;
  return contextProxy;
};

const isMappedVariables = (variables: any) =>
  variables &&
  typeof variables === "object" &&
  WRAPPED_VARIABLE_NAME in variables;

const unwrapVariables = (variables: any) => {
  return isMappedVariables(variables)
    ? variables[WRAPPED_VARIABLE_NAME]
    : variables;
};

const wrapVariables = (dynamic: boolean | undefined, variables: any = {}) => {
  const hasKey = Object.keys(variables).length > 0;
  if (!hasKey) {
    variables = undefined;
  }
  if (!dynamic || isMappedVariables(variables)) return variables;
  return { [WRAPPED_VARIABLE_NAME]: variables };
};

const patchLocalFields = (
  document: DocumentNode,
  fieldMappings: FieldMappings
) => {
  // stack of parent types, the first one is latest type
  const parentTypes: (string | undefined)[] = [];
  return visit(document, {
    [Kind.FIELD]: {
      enter(field, _1, _2, _3, ancestors) {
        let dataType: string | undefined;
        try {
          const parentField = ancestors[ancestors.length - 2];
          const isRoot =
            parentField &&
            (parentField as OperationDefinitionNode).kind ===
              Kind.OPERATION_DEFINITION;
          const availFields =
            (isRoot
              ? fieldMappings.ROOT
              : parentTypes[0]
              ? fieldMappings[parentTypes[0]]
              : undefined) ?? {};

          if (field.name.value in availFields) {
            const mapping = availFields[field.name.value];
            dataType = mapping.type;
            const newField = {
              ...field,
              directives: [
                ...(field.directives ?? []),
                // add @client directive
                {
                  kind: Kind.DIRECTIVE,
                  name: {
                    kind: Kind.NAME,
                    value: "client",
                  },
                },
              ],
            };

            if (!newField.alias && field.name.value !== mapping.field) {
              newField.alias = { kind: Kind.NAME, value: field.name.value };
            }
            // for dynamic query/mutation we must wrap all arguments to __VARS__ arg
            if (newField.arguments?.length) {
              const objValues: ObjectValueNode = {
                kind: Kind.OBJECT,
                fields: newField.arguments.map((arg) => ({
                  kind: Kind.OBJECT_FIELD,
                  name: arg.name,
                  value: arg.value,
                })),
              };

              newField.arguments = [
                {
                  kind: Kind.ARGUMENT,
                  name: { kind: Kind.NAME, value: WRAPPED_VARIABLE_NAME },
                  value: objValues,
                },
              ];
            }

            newField.name = {
              kind: Kind.NAME,
              value: mapping.field,
            };

            return newField;
          }
        } finally {
          parentTypes.unshift(dataType);
        }
      },
      leave() {
        parentTypes.shift();
      },
    },
  });
};

export { createModel, evictQuery, patchLocalFields, ENABLE_HARD_REFETCH };
