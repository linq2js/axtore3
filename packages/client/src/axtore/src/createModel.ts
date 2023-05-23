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
  FieldOptions,
} from "./types";
import type { DocumentNode } from "graphql";
import {
  isState,
  isMutation,
  isQuery,
  isEvent,
  isPromiseLike,
  createProp,
} from "./util";

import { mergeDeep } from "@apollo/client/utilities";
import { createState } from "./createState";
import { createDynamicDocument } from "./createDynamicDocument";
import { createQuery } from "./createQuery";
import { createMutation } from "./createMutation";
import { patchLocalFields } from "./patchLocalFields";
import { getSessionManager } from "./getSessionManager";
import { createContext } from "./createContext";
import { createEvent } from "./createEvent";
import { generateName } from "./generateName";
import { createQueryResolver } from "./createQueryResolver";
import { createMutationResolver } from "./createMutationResolver";
import { createFieldResolver } from "./createFieldResolver";

const EXECUTED_EFFECTS_PROP = Symbol("executedEffects");

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

  const contextFactory: CustomContextFactory<TContext> = (
    apolloContext: ApolloContext
  ) => {
    if (typeof modelOptions.context === "function") {
      return {
        ...apolloContext,
        ...(modelOptions.context as CustomContextFactory<TContext>)(
          apolloContext
        ),
      };
    }
    return { ...apolloContext, ...modelOptions.context } as TContext;
  };

  const init = (client: Client) => {
    // already init for this client
    if ((client as any)[id]) {
      return;
    }

    (client as any)[id] = true;

    let resolvers: any = {};
    let hasNewResolver = false;

    Object.entries(meta).forEach(([typeName, value]) => {
      // do nothing with state or dispatcher
      if (isState(value) || isEvent(value) || typeof value === "function") {
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
            [query.name]: createQueryResolver(client, query, contextFactory),
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
            [mutation.name]: createMutationResolver(
              client,
              mutation,
              contextFactory
            ),
          },
        };
        return;
      }

      // is type resolvers
      Object.entries(value).forEach(([field, resolver]: [string, any]) => {
        if (resolver.model !== model) {
          resolver.model.init(client);
          return;
        }

        hasNewResolver = true;
        resolvers = {
          ...resolvers,
          [typeName]: {
            ...resolvers[typeName],
            [field]: createFieldResolver(
              client,
              resolver,
              field,
              contextFactory
            ),
          },
        };
      });
    });

    if (hasNewResolver) {
      client.addResolvers(resolvers);
    }

    // execute effects
    if (effects.length) {
      const executedEffects = createProp(
        client,
        EXECUTED_EFFECTS_PROP,
        () => new Set<Function>()
      );

      call(client, (context: any) => {
        effects.forEach((effect) => {
          if (executedEffects.has(effect)) return;
          executedEffects.add(effect);
          effect(context);
        });
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
      model,
      {
        client,
        ...contextFactory({ client }),
      },
      getSessionManager(client).start(),
      true
    );
    return action(context, ...args);
  };

  const model: Model<TContext, TMeta> = {
    __type: "model",
    id,
    meta,
    effects,
    createContext: contextFactory,
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
      const [
        alias,
        name = `${modelOptions.name ?? ""}_${alias}` + generateName("query"),
      ] = selection.split(":");
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
        createQuery(model, name, alias, document, resolver, options),
        newFieldMappings
      );
    },
    mutation(selection: string, ...args: any[]) {
      const [
        alias,
        name = `${modelOptions.name ?? ""}_${alias}` + generateName("mutation"),
      ] = selection.split(":");
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
        createMutation(model, name, alias, document, resolver),
        fieldMappings
      );
    },
    state(name, initial, options) {
      return extend(name, createState(model, initial, options));
    },
    effect(fn, continuous) {
      if (continuous) {
        if (typeof continuous !== "string") {
          continuous = "always";
        }

        const originFn = fn;
        fn = (context) => {
          const result = originFn(context);

          if (isPromiseLike(result)) {
            if (continuous === "always") {
              return result.finally(() => fn(context));
            }
            return result.then(() => fn(context));
          }
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              "The continuous effect must return promise like object"
            );
          }
          return result;
        };
      }
      effects.push(fn);
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
            const [typeOrOptions, resolver] = Array.isArray(value)
              ? value
              : [undefined, value];
            const options: FieldOptions =
              typeof typeOrOptions === "string"
                ? { type: typeOrOptions }
                : typeOrOptions ?? {};

            newFieldMappings[name] = {
              ...newFieldMappings[name],
              [key]: { field: key, type: options.type },
            };

            const resolverWrapper = Object.assign(
              (...args: Parameters<FieldResolver<any, any>>) =>
                resolver(...args),
              { options }
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
