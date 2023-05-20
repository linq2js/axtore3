import type {
  ApolloContext,
  Client,
  CreateModel,
  CustomContextFactory,
  FieldResolver,
  Model,
  ModelOptions,
  QueryOptions,
  RootResolver,
  Effect,
  MutationOptions,
  FieldMappings,
} from "./types";
import type { DocumentNode } from "graphql";
import { isState, isMutation, isQuery, unwrapVariables, isEvent } from "./util";

import { mergeDeep } from "@apollo/client/utilities";
import { getData } from "./getData";
import { concurrency } from "./concurrency";
import { createState } from "./createState";
import { createDynamicDocument } from "./createDynamicDocument";
import { createQuery } from "./createQuery";
import { createMutation } from "./createMutation";
import { patchLocalFields } from "./patchLocalFields";
import { patchTypeIfPossible } from "./patchTypeIfPossible";
import { getSessionManager } from "./getSessionManager";
import { createContext } from "./createContext";
import { handleLazyResult } from "./handleLazyResult";
import { createEvent } from "./createEvent";
import { generateName } from "./generateName";

const createModel: CreateModel = (options = {}) => {
  return createModelInternal(options);
};

const createModelInternal = <TContext, TMeta extends Record<string, any>>(
  modelOptions: ModelOptions<TContext>,
  meta: TMeta = {} as any,
  effects: Effect<TContext, TMeta>[] = [],
  fieldMappings: FieldMappings = {}
): Model<TContext, TMeta> => {
  effects = effects.slice();
  const id = Symbol("model");
  const contextFactory: CustomContextFactory<TContext> =
    typeof modelOptions.context === "function"
      ? (modelOptions.context as CustomContextFactory<TContext>)
      : () => (modelOptions.context ?? {}) as unknown as TContext;

  const init = (client: Client) => {
    // already init for this client
    if ((client as any)[id]) {
      return;
    }

    (client as any)[id] = true;

    let resolvers: any = {};
    let hasNewResolver = false;

    Object.entries(meta).forEach(([typeName, value]) => {
      // do nothing with state
      if (isState(value)) {
        return;
      }

      if (isQuery(value)) {
        const query = value;
        if (query.model !== model) {
          query.model.init(client);
          return;
        }
        if (!query.resolver) return;

        hasNewResolver = true;
        resolvers = {
          ...resolvers,
          Query: {
            [query.name]: async (
              _: any,
              args: any,
              apolloContext: ApolloContext
            ) => {
              args = unwrapVariables(args);
              const sm = getSessionManager(client, query.document, args);
              sm.query = query;

              return concurrency(sm, query.options, async () => {
                const session = sm.start();
                const context = createContext(
                  {
                    ...apolloContext,
                    ...contextFactory(apolloContext),
                  },
                  session,
                  meta,
                  false,
                  undefined,
                  () => sm.data
                );
                const result = await handleLazyResult(
                  client,
                  session,
                  "query",
                  () => query.mergeOptions({ variables: args }),
                  query.name,
                  await query.resolver?.(context, args)
                );

                sm.onLoad.invokeAndClear();

                if (query.options.type) {
                  return patchTypeIfPossible(result, query.options.type);
                }

                return result;
              });
            },
          },
        };
        return;
      }

      if (isMutation(value)) {
        const mutation = value;
        if (mutation.model !== model) {
          mutation.model.init(client);
          return;
        }

        if (!mutation.resolver) return;

        hasNewResolver = true;
        resolvers = {
          ...resolvers,
          Mutation: {
            [mutation.name]: async (
              _: any,
              args: any,
              apolloContext: ApolloContext
            ) => {
              args = unwrapVariables(args);
              const sm = getSessionManager(client, false);
              sm.mutation = mutation;

              return concurrency(mutation, mutation.options, async () => {
                const session = sm.start();
                const context = createContext(
                  {
                    ...apolloContext,
                    ...contextFactory(apolloContext),
                  },
                  session,
                  meta,
                  true,
                  undefined,
                  () =>
                    // create simple data object for mutation
                    getData(client, mutation, {}, (_, key) => ({ key }))
                );
                const data = await mutation.resolver?.(context, args);

                if (mutation.options.type) {
                  return patchTypeIfPossible(data, mutation.options.type);
                }

                return data;
              });
            },
          },
        };
        return;
      }

      if (isEvent(value)) {
        // do nothing
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
              [resolverName]: async (
                parent: any,
                args: any,
                apolloContext: ApolloContext
              ) => {
                args = unwrapVariables(args);
                const sm = getSessionManager(client, false);
                const session = sm.start();
                const context = createContext(
                  {
                    ...apolloContext,
                    ...contextFactory(apolloContext),
                  },
                  session,
                  meta,
                  false
                );
                const rawResult = await resolver(context, args, parent);
                const result = await handleLazyResult(
                  client,
                  session,
                  "type",
                  () => client.cache.identify(parent),
                  resolverName,
                  rawResult
                );
                session.manager.onLoad.invokeAndClear();
                return result;
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
    id,
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
    event(name) {
      return extend(
        name,
        createEvent(model, generateName("event") + "." + name)
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
        createQuery(model, name, document, resolver, options),
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
      return model;
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

export { createModel };
