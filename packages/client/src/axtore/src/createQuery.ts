import {
  Atom,
  Client,
  CreateDynamicQueryOptions,
  CreateQueryOptions,
  CreateStaticQueryOptions,
  EMPTY_RESOLVERS,
  NoInfer,
  OperationEvents,
  Query,
  QueryContext,
  QueryHandler,
  QueryResolver,
  TypeDef,
  VariableBuilderContext,
  WithVariables,
} from "./types";
import {
  addResolvers,
  createDynamicDocument,
  evictQuery,
  getObservableQuery,
  getUpdatedData,
  refetchQuery,
  unwrapVariables,
  wrapDynamicResolver,
  wrapVariables,
} from "./resolver";
import {
  createProp,
  documentType,
  forEach,
  is,
  isAtom,
  isFunction,
  selectDefinition,
} from "./util";

import { DocumentNode } from "graphql";
import { QueryOptions } from "@apollo/client";
import { callbackGroup } from "./callbackGroup";
import { generateName } from "./generateName";

export type CreateQuery = {
  /**
   * create static query
   */
  <TVariables = any, TData = any>(
    document: DocumentNode,
    options?: NoInfer<CreateStaticQueryOptions<TVariables, TData>>
  ): Query<TVariables, TData>;

  /**
   * create dynamic query
   */
  <TField extends string, TVariables = any, TData = any>(
    field: TField,
    resolver: QueryResolver<TVariables, TData>,
    options?: CreateDynamicQueryOptions<TVariables, TData>
  ): Query<TVariables, { [key in TField]: TData }>;
};

const createVariableBuilder = (
  client: Client,
  query: Query,
  variables: any
) => {
  let fn: (context: VariableBuilderContext) => any;
  if (isFunction(variables)) {
    fn = variables;
  } else if (typeof variables === "object") {
    const values = Object.values(variables);
    if (values.some(isAtom)) {
      const entries = Object.entries(variables);
      fn = ({ get }) => {
        const result: Record<string, any> = {};
        entries.forEach(([key, value]) => {
          if (isAtom(value)) {
            result[key] = get(value);
          } else {
            result[key] = value;
          }
        });
        return result;
      };
    } else {
      fn = () => variables;
    }
  } else {
    fn = () => variables;
  }
  const dependencies = new Set<Atom>();
  const newDependencies = new Set<Atom>();
  const onChange = () => {
    refetchQuery(client, query.use(client).mergeOptions(), {
      always: false,
      all: true,
    });
  };
  const context: VariableBuilderContext = {
    get(atom) {
      if (!dependencies.has(atom)) {
        dependencies.add(atom);
        newDependencies.add(atom);
      }
      return atom.use(client).get();
    },
  };

  return {
    build() {
      const variables = fn(context);
      newDependencies.forEach((dependency) => {
        dependency.use(client).subscribe({ onChange });
      });
      newDependencies.clear();
      return variables;
    },
  };
};

const createQueryInternal = <TVariables = any, TData = any>(
  document: DocumentNode,
  typeDefs: TypeDef[],
  resolvers: Record<string, any> = EMPTY_RESOLVERS,
  options: NoInfer<
    CreateQueryOptions<TVariables, TData> & { dynamic?: boolean }
  > = {}
): Query<TVariables, TData> => {
  const {
    key,
    fetchPolicy,
    variables: defaultVariables,
    context: defaultContext,
    evict: evictOptions,
    refetch: refetchOptions,
    onCompleted,
    onError,
    dynamic,
    equal,
  } = options;
  const connectedProp = Symbol(generateName("query", key));
  const mergeOptions = (
    variableBuilder: ReturnType<typeof createVariableBuilder>,
    options?: Omit<QueryOptions<any, any>, "query"> &
      OperationEvents<void, TData>
  ) => {
    const variables = wrapVariables(dynamic, {
      ...variableBuilder.build(),
      ...unwrapVariables(options?.variables),
    });

    return {
      query: document,
      fetchPolicy,
      ...options,
      variables,
      context: { ...defaultContext, ...options?.context },
      onCompleted:
        options?.onCompleted || onCompleted
          ? (data: any) => {
              onCompleted?.(data, variables);
              options?.onCompleted?.(data);
            }
          : undefined,
      onError:
        options?.onError || onError
          ? (error: any) => {
              onError?.(error, variables);
              options?.onError?.(error);
            }
          : undefined,
    };
  };

  const query: Query = {
    type: "query" as const,
    document,
    dynamic: !!dynamic,
    wrap(prop, { map, init, cache } = {}): any {
      return createQuery(prop, async (args: any, context: QueryContext) => {
        if (init) {
          await init(args, context);
        }

        const result: any = await context.get(query, {
          variables: args,
          fetchPolicy: cache ? undefined : "no-cache",
        } as any);

        return map?.(result, { ...context, args });
      });
    },
    use(client) {
      return createProp(
        client,
        connectedProp,
        (): QueryHandler<TVariables, TData> => {
          const variableBuilder = createVariableBuilder(
            client,
            query,
            defaultVariables
          );

          addResolvers(client, query, resolvers, typeDefs);

          // handle evicting logic
          if (evictOptions) {
            const { when, fields } = evictOptions;
            const removeListener = callbackGroup();
            const doEvicting = () => {
              evictQuery(client, query, fields);
            };
            forEach(when, (listenable) => {
              removeListener(listenable(client, doEvicting));
            });
          }

          if (refetchOptions) {
            const { when, variables } = refetchOptions;

            const doRefetching = () => {
              refetchQuery(
                client,
                { ...mergeOptions(variableBuilder, { variables }) },
                { always: false, all: !variables }
              );
            };

            forEach(when, (listenable) => {
              listenable(client, doRefetching);
            });
          }

          return {
            mergeOptions(options) {
              return mergeOptions(variableBuilder, options as any);
            },
            refetch(...args) {
              const options = (args[0] as WithVariables<TVariables, {}>) || {};

              return refetchQuery(
                client,
                mergeOptions(variableBuilder, options)
              );
            },
            subscribe(options?) {
              const queryOptions = mergeOptions(variableBuilder, {
                variables: (options as any).variables,
              });
              const observableQuery = getObservableQuery(
                query,
                client,
                queryOptions
              );
              let prevData = client.readQuery(queryOptions);
              let waitForNextChange = !!prevData;
              const subscription = observableQuery.subscribe((result) => {
                if (result.loading) return;
                if (result.error) return;
                if (waitForNextChange) {
                  waitForNextChange = false;
                  return;
                }

                if (equal && equal(prevData, result.data)) {
                  return;
                }

                prevData = result.data;
                options?.onChange?.(result.data as any);
              });
              return () => {
                subscription.unsubscribe();
              };
            },
            set(options?) {
              const data = options?.data as any;
              const queryOptions = mergeOptions(variableBuilder, {
                variables: (options as any).variables,
              });

              if (isFunction(data)) {
                const prevData = client.readQuery(queryOptions);

                if (prevData) {
                  client.writeQuery({
                    ...queryOptions,
                    data: getUpdatedData(data, () => prevData),
                  });
                }
              } else {
                client.writeQuery({
                  ...queryOptions,
                  data,
                });
              }
            },
            async get(...args) {
              const queryOptions = mergeOptions(variableBuilder, args[0]);
              const result = await client.query(queryOptions);
              if (!result) throw new Error("Invalid query data");
              if (result.error) throw result.error;
              return result.data as TData;
            },
          };
        }
      );
    },
  };

  return query;
};

const createQuery: CreateQuery = (...args: any[]) => {
  // query(field, resolver, options?)
  if (typeof args[0] === "string") {
    const [field, resolver, options] = args as [
      string,
      Function,
      CreateDynamicQueryOptions | undefined
    ];

    const { fieldName, document } = createDynamicDocument(
      "query",
      field,
      options?.key
    );

    return createQueryInternal(
      document,
      [],
      {
        [fieldName]: options?.type
          ? [wrapDynamicResolver(resolver), options?.type]
          : wrapDynamicResolver(resolver),
      },
      { ...options, dynamic: true }
    );
  }

  if (is(args[0], documentType)) {
    // query(document, options?)
    const [document, options] = args as [
      DocumentNode,
      CreateStaticQueryOptions | undefined
    ];

    return createQueryInternal(
      options?.operation
        ? selectDefinition(document, "query", options.operation)
        : document,
      options?.types ?? [],
      options?.resolve,
      options
    );
  }

  throw new Error(`No overload for these arguments ${args} supported`);
};

export { createQuery };
