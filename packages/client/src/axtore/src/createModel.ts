import {
  ApolloContext,
  Client,
  CreateModel,
  CustomContextFactory,
  FieldResolver,
  Model,
  ModelOptions,
  QueryOptions,
  RootResolver,
  UpdateRecipe,
  Effect,
  MutationOptions,
  FieldMappings,
} from "./types";
import { DocumentNode } from "graphql";
import { isState, isMutation, isQuery, unwrapVariables } from "./util";

import { mergeDeep } from "@apollo/client/utilities";
import produce from "immer";
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

const createModel: CreateModel = (options = {}) => {
  return createModelInternal(options);
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
              return concurrency(sessionManager, value.options, async () => {
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

                if (value.options.type) {
                  return patchTypeIfPossible(data, value.options.type);
                }
                return data;
              });
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
              const sessionManager = getSessionManager(client, false);
              return concurrency(value, value.options, async () => {
                const session = sessionManager.start();
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
                if (value.options.type) {
                  return patchTypeIfPossible(data, value.options.type);
                }
                return data;
              });
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

export { createModel };
