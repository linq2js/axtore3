import {
  ApolloContext,
  AtomContext,
  Atom,
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
} from "./types2";
import { DocumentNode } from "graphql";
import {
  ApolloQueryResult,
  FetchPolicy,
  FetchResult,
  makeVar,
  ObservableQuery,
} from "@apollo/client";
import { createProp, isAtom, isMutation, isQuery } from "./util";

import equal from "@wry/equality";
import { generateName } from "./generateName";
import gql from "graphql-tag";
import { mergeDeep } from "@apollo/client/utilities";
import { CallbackGroup, callbackGroup } from "./callbackGroup";
import produce from "immer";

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
  };
};

const createMutation = <TVariables, TData>(
  model: Model,
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
  };
};

const createAtom = <TData>(
  model: Model,
  initial: TData | ((context: AtomContext<any, any>) => TData),
  name?: string
): Atom<TData> => {
  const id = generateName("atom", name);
  return {
    type: "atom",
    name: id,
    model,
    initial,
  };
};

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
  meta: TMeta = {} as any
): Model<TContext, TMeta> => {
  const modelId = generateName("model");
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
      // do nothing with atom
      if (isAtom(value)) {
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
                () => sessionManager.observableQuery
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
              const context = createContext(apolloContext, session, meta, true);
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
                  false,
                  () => session.manager.observableQuery
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
  };

  const call = (
    originalContext: ApolloContext,
    action: Function,
    ...args: any[]
  ) => {
    init(originalContext.client);
    const context = createContext(
      {
        ...originalContext,
        ...contextFactory(originalContext),
      },
      getSessionManager(originalContext.client).start(),
      meta,
      true
    );
    return action(context, ...args);
  };

  const model: Model<TContext, TMeta> = {
    meta,
    init,
    use(newMeta) {
      return createModelInternal(modelOptions, { ...meta, ...newMeta });
    },
    query(selection: string, ...args: any[]) {
      const [alias, name = alias] = selection.split(":");
      let document: DocumentNode;
      let resolver: RootResolver<TContext, any, any> | undefined;
      let options: QueryOptions | undefined;

      // is resolver
      if (typeof args[0] === "function") {
        document = createDynamicDocument("query", name, alias);
        resolver = args[0];
        options = args[1];
      } else {
        document = args[0];
        options = args[1];
      }
      const { type } = options ?? {};
      const query = createQuery(model, name, document, resolver, type);
      const newModel = createModelInternal(modelOptions, {
        ...meta,
        [alias]: query,
      });
      Object.assign(query, { model: newModel });
      return newModel;
    },
    mutation(selection, ...args: any[]) {
      const [alias, name = alias] = selection.split(":");
      let document: DocumentNode;
      let resolver: RootResolver<TContext, any, any> | undefined;

      // is resolver
      if (typeof args[0] === "function") {
        document = createDynamicDocument("mutation", name, alias);
        resolver = args[0];
      } else {
        document = args[0];
      }
      const mutation = createMutation(model, name, document, resolver);
      const newModel = createModelInternal(modelOptions, {
        ...meta,
        [alias]: mutation,
      });
      Object.assign(mutation, { model: newModel });
      return newModel;
    },
    atom(name, initial, options) {
      const atom = createAtom(model, initial, options?.name);
      const newModel = createModelInternal(modelOptions, {
        ...meta,
        [name]: atom,
      });
      Object.assign(atom, { model: newModel });
      return newModel;
    },
    type(name, resolvers) {
      const resolverWrappers: Function[] = [];

      const newModel = createModelInternal(
        modelOptions,
        mergeDeep(meta, {
          // assign model
          [name]: Object.entries(resolvers).reduce((prev, [key, resolver]) => {
            const resolverWrapper = (
              ...args: Parameters<FieldResolver<any, any>>
            ) => {
              return resolver(...args);
            };
            resolverWrappers.push(resolverWrapper);
            return {
              ...prev,
              [key]: resolverWrapper,
            };
          }, {}),
        })
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
  readonly observableQuery: ObservableQuery;
  start(): Session;
  onLoad: CallbackGroup;
  onDispose: CallbackGroup;
  refetch(): Promise<ApolloQueryResult<any>>;
};

type Session = {
  readonly isActive: boolean;
  readonly manager: SessionManager;

  /**
   * this uses for query session only
   */
};

const getSessionManager = (client: Client, group: any = {}, key: any = {}) => {
  const sessionManagerGroups = createProp(
    client,
    "sessionManagerGroups",
    () => new WeakMap<any, SessionManager[]>()
  );

  let sessionManagerGroup = group ? sessionManagerGroups.get(group) : undefined;

  if (group && !sessionManagerGroup) {
    sessionManagerGroup = [];
    sessionManagerGroups.set(group, sessionManagerGroup);
  }

  let sessionManager = sessionManagerGroup?.find((x) => equal(x.key, key));

  if (!sessionManager) {
    let currentToken = {};
    const onDispose = callbackGroup();
    const onLoad = callbackGroup();
    let observableQuery: ObservableQuery | undefined;

    const sm = {
      key,
      onDispose,
      onLoad,
      get observableQuery() {
        if (!observableQuery) {
          observableQuery = client.watchQuery({
            query: group,
            variables: key,
          });
        }
        return observableQuery;
      },
      refetch() {
        onDispose.invokeAndClear();
        onLoad.invokeAndClear();
        return sm.observableQuery.refetch();
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
          manager: sm,
          onDispose,
        };
      },
    };
    sessionManager = sm;
    sessionManagerGroup?.push(sm);
  }

  return sessionManager;
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

const createAtomDispatcher = <TData>(
  originalContext: ApolloContext,
  atom: Atom<TData>,
  session: Session,
  updatable: boolean,
  meta: any,
  recomputeDerivedAtom?: VoidFunction
) => {
  const atomHandler = createProp(
    originalContext.client,
    // must add atom suffix to make no duplicates to other entity name
    atom.name + "Atom",
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
        if (typeof atom.initial === "function") {
          const nestedContext = createContext(
            originalContext,
            newSession,
            meta,
            updatable,
            undefined,
            recompute
          );
          nextValue = (atom.initial as Function)(nestedContext);
        } else {
          nextValue = atom.initial;
        }
        sm.onLoad.invokeAndClear();
        setValue(nextValue);
      };

      recompute();

      return {
        get() {
          return rv();
        },
        set(value: any) {
          // setter
          const nextValue = getUpdatedData(value, rv);
          setValue(nextValue);
        },
        next: rv.onNextChange,
      };
    }
  );

  return (...args: any[]) => {
    if (!args.length) {
      const value = atomHandler.get();
      if (recomputeDerivedAtom) {
        session.manager.onLoad(() =>
          session.manager.onDispose(atomHandler.next(recomputeDerivedAtom))
        );
      }
      return value;
    }
    if (!updatable) {
      throw new Error("Updating atom in this context is not allowed");
    }
    atomHandler.set(args[0]);
  };
};

const createQueryDispatcher = <TVariables, TData>(
  client: Client,
  query: Query<TVariables, TData>,
  session: Session,
  contextProxy: any,
  getDerivedQuery?: () => ObservableQuery
) => {
  const fetch = async (variables: any, fetchPolicy?: FetchPolicy) => {
    return handleFetchResult(
      await client.query({
        query: query.document,
        variables: wrapVariables(!!query.resolver, variables),
        fetchPolicy,
      })
    );
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
          let prevData = oq.getCurrentResult().data;
          const subscription = oq.subscribe((result) => {
            if (
              result.error ||
              result.loading ||
              prevData === oq.getCurrentResult().data
            ) {
              return;
            }
            subscription.unsubscribe();
            if (session.isActive) {
              getDerivedQuery().refetch();
            }
          });
          session.manager.onDispose(() => subscription.unsubscribe());
        });
      }
      return data;
    },
    {
      resolve(variables: any) {
        // call query resolver directly if possible
        if (query.resolver) {
          return query.resolver(variables, contextProxy);
        }
        // unless call query with no-cache fetchPolicy
        return fetch(variables, "no-cache");
      },
      async refetch(variables: any = {}) {
        return handleFetchResult(
          await getSessionManager(client, query.document, variables).refetch()
        );
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
  getDerivedQuery?: () => ObservableQuery,
  recomputeDerivedAtom?: VoidFunction
) => {
  const resolvedProps = new Map<any, any>();
  const contextProxy = new Proxy(
    {},
    {
      get(_, p) {
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

          if (isAtom(value)) {
            const dispatcher = createAtomDispatcher(
              originalContext,
              value,
              session,
              updatable,
              meta,
              recomputeDerivedAtom
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

const wrapVariables = (dynamic: boolean | undefined, variables: any) => {
  if (!dynamic || isMappedVariables(variables)) return variables;
  return { [WRAPPED_VARIABLE_NAME]: variables };
};

export { createModel };
