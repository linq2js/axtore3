import { ApolloError, QueryOptions } from "@apollo/client";
import {
  Atom,
  Client,
  EMPTY_RESOLVERS,
  LazyResult,
  LazyResultOptions,
  Mutation,
  MutationContext,
  Query,
  QueryContext,
  QueryResolver,
  TypeDef,
  UpdateRecipe,
  WithVariables,
} from "./types";
import { Kind, OperationDefinitionNode } from "graphql";
import {
  createProp,
  enqueue,
  is,
  isAtom,
  isFunction,
  isLazy,
  isMutation,
} from "./util";

import { callbackGroup } from "./callbackGroup";
import { createEntitySet } from "./createEntitySet";
import { isQuery } from "./util";
import produce from "immer";

export type Session = {
  readonly onDispose: Map<any, VoidFunction>;
  refetch(): Promise<void>;
  start(): () => boolean;
};

const registeredTypesProp = Symbol("registeredTypes");

const getRegisteredTypes = (client: Client) => {
  return createProp(client, registeredTypesProp, () => new Set<string>());
};

const lazy = <T>(
  value: T,
  loader: LazyResult<T>["loader"],
  options: LazyResultOptions = {}
): LazyResult<T> => ({
  type: "lazy" as const,
  value,
  loader,
  options,
});

const addResolver = <T extends Query | Mutation>(
  client: Client,
  owner: T,
  registeredResolvers: Record<string, any>,
  registeredTypes: Set<string>,
  type: string,
  field: string,
  resolver: QueryResolver,
  typeDef?: TypeDef
) => {
  const key = `${type}.${field}`;
  if (registeredTypes.has(key)) return registeredResolvers;

  registeredTypes.add(key);
  const resolverWrapper = wrapResolver(client, owner, field, resolver, typeDef);

  return {
    ...registeredResolvers,
    [type]: {
      ...registeredResolvers[type],
      [field]: resolverWrapper,
    },
  };
};

const addResolvers = (
  client: Client,
  owner: Query | Mutation,
  resolvers: Record<string, Atom | QueryResolver | [QueryResolver, TypeDef]>,
  typeDefs: TypeDef[]
) => {
  let registeredResolvers: Record<string, any> = EMPTY_RESOLVERS;
  const rootType = owner.type === "mutation" ? "Mutation" : "Query";
  const registeredTypes = getRegisteredTypes(client);

  const registerType = (typeDef: TypeDef) => {
    const fields = typeDef.fields ?? {};
    Object.keys(fields).forEach((field) => {
      const fieldTuple = fields[field];
      const [value, subTypeDef] = Array.isArray(fieldTuple)
        ? fieldTuple
        : [fieldTuple, undefined];

      // field resolver
      if (typeof value === "function") {
        registeredResolvers = addResolver(
          client,
          owner,
          registeredResolvers,
          registeredTypes,
          typeDef.name,
          field,
          value,
          subTypeDef
        );
      } else {
        if (!typeDef.__fieldMappers) {
          typeDef.__fieldMappers = {};
        }
        typeDef.__fieldMappers[field] = createTypeMapper(value);
        registerType(value);
      }
    });
  };

  if (resolvers !== EMPTY_RESOLVERS) {
    Object.keys(resolvers).forEach((field) => {
      const resolverTuple = resolvers[field];
      // field name might be followed this pattern `alias:field`
      field = field.split(":").pop() ?? field;
      let [resolver, typeDef] = Array.isArray(resolverTuple)
        ? resolverTuple
        : [resolverTuple, undefined];

      if (typeDef) {
        registerType(typeDef);
      }

      if (isAtom(resolver)) {
        const atom = resolver;
        resolver = (_: any, context: QueryContext) => context.get(atom);
      }

      registeredResolvers = addResolver(
        client,
        owner,
        registeredResolvers,
        registeredTypes,
        rootType,
        field,
        resolver,
        typeDef
      );
    });
  }

  if (typeDefs) {
    typeDefs.forEach((typeDef) => typeDef && registerType(typeDef));
  }

  // has resolver
  if (registeredResolvers !== EMPTY_RESOLVERS) {
    client.addResolvers(registeredResolvers);
  }
};

const createTypeMapper = (typeDef: TypeDef) => {
  const assignType = (value: any) => {
    // if the value has no __typename prop, assign __typename and assign nested types recursively
    if (value && typeof value === "object" && !("__typename" in value)) {
      value = { ...value, __typename: typeDef.name };
      const fieldMappers = typeDef.__fieldMappers;
      if (fieldMappers) {
        Object.keys(fieldMappers).forEach((field) => {
          value[field] = fieldMappers[field](value[field]);
        });
      }
    }
    // unless it is primitive types or it has already __typename prop
    return value;
  };

  return (value: any) => {
    if (Array.isArray(value)) {
      return value.map(assignType);
    }
    return assignType(value);
  };
};

const createQueryContext = (
  client: Client,
  context: any,
  self: any,
  args: any,
  effects: Function[],
  session?: Session,
  isActive?: () => boolean,
  getPrevData?: () => any
) => {
  const queryContext: QueryContext = {
    self,
    context,
    client,
    effect(fn) {
      effects.push(fn);
    },
    on(input: any, callback: (data: any) => void) {
      let unsubscribe: VoidFunction | undefined;
      if (isAtom(input)) {
        unsubscribe = input.use(client).subscribe({ onChange: callback });
      } else if (isQuery(input)) {
        unsubscribe = input.use(client).subscribe({ onChange: callback });
      } else {
        throw new Error(`Invalid input. Expected query/atom but got ${input}`);
      }
      session?.onDispose.set({}, unsubscribe);
      return unsubscribe;
    },
    call(...args: any[]) {
      if (isMutation(args[0])) {
        return args[0].use(client).call(args[1]);
      }

      const [resolver, newArgs] = args;
      const hasArgs = arguments.length > 1;

      if (hasArgs) {
        return resolver(self, newArgs, queryContext);
      }
      return resolver(self, args, queryContext);
    },
    get(input?: Query | Atom, options?: any): any {
      if (!arguments.length && getPrevData) {
        return getPrevData();
      }
      if (isAtom(input)) {
        const connectedAtom = input.use(client);

        // should subscribe only if the session is active
        if (session && isActive?.()) {
          if (!session.onDispose.has(input)) {
            session.onDispose.set(
              input,
              connectedAtom.subscribe({ onChange: session.refetch })
            );
          }
        }

        return connectedAtom.get();
      }

      if (isQuery(input)) {
        const connectedQuery = input.use(client);

        // should subscribe only if the session is active
        if (session && isActive?.()) {
          if (!session.onDispose.has(input)) {
            return connectedQuery.get(options).then((data) => {
              session.onDispose.set(
                {},
                connectedQuery.subscribe({
                  variables: options?.variables,
                  onChange: session.refetch,
                })
              );

              return data;
            });
          }
        }

        return connectedQuery.get(options);
      }

      throw new Error(
        `Invalid input expect atom/query/mutation, but got ${input}`
      );
    },
  };

  return queryContext;
};

const refetchQuery = async (client: Client, options: QueryOptions) => {
  const observableQuery = client.watchQuery(options);
  const result = await observableQuery.refetch();
  if (result.error) throw result.error;
  return result.data;
};

const createSession = (client: Client, queryOptions: QueryOptions): Session => {
  const onDispose = new Map<any, VoidFunction>();
  let refetchToken = {};
  let refetchPromise: Promise<void> | undefined;
  let currentToken = {};
  // avoid query refetch multiple time
  const refetch = () => {
    if (!refetchPromise) {
      refetchPromise = new Promise((resolve) => {
        const doRefetch = () => {
          let token = refetchToken;
          enqueue(() => {
            if (token !== refetchToken) {
              return doRefetch();
            }
            // at this time, we can start new refetching request if any
            refetchPromise = undefined;
            refetchQuery(client, queryOptions).finally(resolve);
          });
        };

        doRefetch();
      });
    }
    return refetchPromise;
  };

  return {
    refetch,
    onDispose,
    start() {
      const callbacks = Array.from(onDispose.values());
      onDispose.clear();
      callbacks.forEach((callback) => callback());
      currentToken = {};
      const token = currentToken;
      return () => token === currentToken;
    },
  };
};

const evictQuery = (
  client: Client,
  query: Query,
  fields?: string[] | Record<string, any>
) => {
  const op = query.document.definitions[0] as OperationDefinitionNode;
  const fieldMappings: Record<string, string> = {};

  op.selectionSet.selections.forEach((selection) => {
    if (selection.kind === Kind.FIELD) {
      if (selection.alias?.value) {
        fieldMappings[selection.alias.value] = selection.name.value;
      } else {
        fieldMappings[selection.name.value] = selection.name.value;
      }
    }
  });

  if (!fields) {
    fields = Object.keys(fieldMappings);
  }

  if (Array.isArray(fields)) {
    const fieldNameAndValues: Record<string, any> = {};
    fields.forEach((field) => (fieldNameAndValues[field] = true));
    fields = fieldNameAndValues;
  }

  Object.entries(fields).forEach(([field, variables]: [string, any]) => {
    if (variables === false) return;
    const originalField = fieldMappings[field];
    if (!originalField) return;
    client.cache.evict({
      id: "ROOT_QUERY",
      fieldName: originalField,
      args: variables === true ? {} : variables,
    });
  });
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

const createMutationContext = (
  client: Client,
  context: any,
  self: any,
  args: any,
  effects: Function[]
): MutationContext => {
  return {
    ...createQueryContext(client, context, self, args, effects),
    set(input: any, options: any) {
      // set(atom, options)
      if (isAtom(input)) {
        return input.use(client).set(options);
      }

      // set(query, options)
      if (isQuery(input)) {
        return input.use(client).set(options);
      }

      // set(entities, fields)
      const [entities, fields] = args;
      const copyOfFields: Record<string, any> = { ...fields };
      Object.keys(copyOfFields).forEach((key) => {
        let recipe = copyOfFields[key];
        if (typeof recipe !== "function") {
          const value = recipe;
          recipe = () => value;
        }
        copyOfFields[key] = (prev: any) => produce(prev, recipe);
      });

      (Array.isArray(entities) ? entities : [entities]).forEach((entity) => {
        client.cache.modify({
          id: client.cache.identify(entity),
          fields: copyOfFields,
        });
      });
    },
    evict(...args: any[]) {
      if (isQuery(args[0])) {
        evictQuery(client, args[0], args[1]);
      } else {
        let entities: any[] = [];
        // evict(typeName, id)
        if (typeof args[0] === "string") {
          entities.push({ __typename: args[0], id: args[1] });
        }
        // evict(typeDef, id)
        else if (
          is<TypeDef>(
            args[0],
            (x) => typeof x?.name === "string" && typeof args[1] !== "undefined"
          )
        ) {
          entities.push({ __typename: args[0].name, id: args[1] });
        } else {
          // evict(...entities)
          entities.push(...args);
        }

        (Array.isArray(entities) ? entities : [entities]).forEach((entity) => {
          client.cache.evict({
            id: client.cache.identify(entity),
          });
        });
      }

      client.cache.gc();
    },
    refetch(query, ...args) {
      const options = args[0] as WithVariables<{}, {}>;

      return refetchQuery(client, query.mergeOptions(options));
    },
  };
};

const wrapResolver = <T extends Query | Mutation>(
  client: Client,
  owner: T,
  field: string,
  resolver: QueryResolver,
  typeDef?: TypeDef
) => {
  const sessions = createEntitySet<Session>();
  const mapResultType = (result: any) => {
    if (typeDef) {
      return createTypeMapper(typeDef)(result);
    }
    return result;
  };

  if (isQuery(owner)) {
    return async (value: any, args: any, context: any, _: any) => {
      if (!args) args = {};

      const session = sessions.get(args, () =>
        createSession(client, owner.mergeOptions({ variables: args }))
      );
      const isActive = session.start();
      const effects: Function[] = [];
      const result = await resolver(
        args,
        createQueryContext(
          client,
          context,
          value,
          args,
          effects,
          session,
          isActive,
          () => client.readQuery(owner.mergeOptions({ variables: args }))
        )
      );

      if (isLazy(result)) {
        const lazy = result;
        const fetchLazyValue = () => {
          if (!isActive()) return;
          lazy.loader().then((lazyValue) => {
            if (!isActive()) return;
            const queryOptions = owner.mergeOptions();

            client.writeQuery({
              ...queryOptions,
              data: {
                // keep prev values
                ...client.readQuery(queryOptions),
                [field]: mapResultType(lazyValue),
              },
            });

            if (lazy.options.interval) {
              setTimeout(fetchLazyValue, lazy.options.interval);
            }
          });
        };

        fetchLazyValue();

        return runEffects(
          effects,
          mapResultType(lazy.value),
          session,
          isActive
        );
      }

      return runEffects(effects, mapResultType(result), session, isActive);
    };
  }

  return async (value: any, args: any, context: any) => {
    if (!args) args = {};
    const effects: Function[] = [];
    const result = await resolver(
      args,
      createMutationContext(client, context, value, args, effects)
    );

    return mapResultType(result);
  };
};

const runEffects = <T>(
  effects: Function[],
  data: T,
  session: Session,
  isActive: () => boolean
) => {
  if (isActive()) {
    enqueue(() => {
      if (!isActive()) return;
      const disposeAll = callbackGroup();
      effects.forEach((effect) => {
        const dispose = effect({ data, refetch: session.refetch });
        if (isFunction(dispose)) {
          disposeAll(dispose);
        }
      });

      if (disposeAll.size()) {
        session.onDispose.set({}, disposeAll.invokeAndClear);
      }
    });
  }

  return data;
};

export { lazy, addResolvers, refetchQuery, evictQuery, getUpdatedData };
