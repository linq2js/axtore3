import {
  CreateDynamicQueryOptions,
  CreateQueryOptions,
  CreateStaticQueryOptions,
  EMPTY_RESOLVERS,
  NoInfer,
  Query,
  QueryHandler,
  QueryResolver,
  TypeDef,
  WithVariables,
} from "./types";
import { DocumentNode, OperationTypeNode } from "graphql";
import {
  addResolvers,
  createDynamicDocument,
  evictQuery,
  getUpdatedData,
  refetchQuery,
  unwrapVariables,
  wrapDynamicResolver,
  wrapVariables,
} from "./resolverUtils";
import {
  createProp,
  documentType,
  forEach,
  is,
  isFunction,
  selectDefinition,
} from "./util";

import { callbackGroup } from "./callbackGroup";
import { generateName } from "./generateName";

export type CreateQuery = {
  /**
   * create static query
   */
  <TVariables = any, TData = any>(
    document: DocumentNode,
    options?: CreateStaticQueryOptions<TVariables, TData>
  ): Query<TVariables, TData>;

  /**
   * create dynamic query
   */
  <TField extends string, TVariables = any, TData = any>(
    field: TField,
    resolver: QueryResolver<TVariables, TData>,
    options?: CreateDynamicQueryOptions<TVariables, TData>
  ): Query<TVariables, { [key in TField]: TData }>;

  <TVariables = any, TData = any>(
    queries: {
      [key in keyof TData]:
        | Query<TVariables, TData[key]>
        | QueryResolver<TVariables, TData[key]>
        | DocumentNode;
    },
    options?: CreateQueryOptions<TVariables, TData>
  ): Query<TVariables, TData>;
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
    dynamic,
    equal,
  } = options;
  const connectedProp = Symbol(generateName("query", key));
  const mergeOptions: Query["mergeOptions"] = (options) => {
    const variables = {
      ...defaultVariables,
      ...unwrapVariables(options?.variables),
    };
    return {
      query: document,
      fetchPolicy,
      variables: wrapVariables(dynamic, variables),
      context: { ...defaultContext, ...options?.context },
    };
  };

  const query: Query = {
    type: "query" as const,
    document,
    mergeOptions,
    dynamic: !!dynamic,
    use(client) {
      return createProp(
        client,
        connectedProp,
        (): QueryHandler<TVariables, TData> => {
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
              refetchQuery(client, { ...mergeOptions({ variables }) });
            };

            forEach(when, (listenable) => {
              listenable(client, doRefetching);
            });
          }

          return {
            refetch(...args) {
              const options = (args[0] as WithVariables<TVariables, {}>) || {};

              return refetchQuery(client, mergeOptions(options));
            },
            subscribe(options?) {
              const queryOptions = mergeOptions({
                variables: (options as any).variables,
              });
              const observableQuery = client.watchQuery(queryOptions);
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
              const queryOptions = mergeOptions({
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
              const queryOptions = mergeOptions({
                variables: args[0]?.variables,
              });
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
        ? selectDefinition(document, OperationTypeNode.QUERY, options.operation)
        : document,
      options?.types ?? [],
      options?.resolve,
      options
    );
  }

  throw new Error(`No overload for these arguments ${args} supported`);
};

export { createQuery };
