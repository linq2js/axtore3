import {
  CreateQueryOptions,
  EMPTY_RESOLVERS,
  NoInfer,
  Query,
  QueryHandler,
  TypeDef,
  WithVariables,
} from "./types";
import {
  addResolvers,
  evictQuery,
  getUpdatedData,
  refetchQuery,
} from "./resolverUtils";
import { createProp, isFunction } from "./util";

import { DocumentNode } from "graphql";
import { callbackGroup } from "./callbackGroup";
import { generateName } from "./generateName";

const createQuery = <TVariables, TData>(
  document: DocumentNode,
  typeDefs: TypeDef[],
  options: NoInfer<CreateQueryOptions<TVariables, TData>> = {}
): Query<TVariables, TData> => {
  const {
    key,
    fetchPolicy,
    resolve: resolvers = EMPTY_RESOLVERS,
    variables: defaultVariables,
    context: defaultContext,
    evict: evictOptions,
    refetch: refetchOptions,
    equal,
  } = options;
  const connectedProp = Symbol(generateName("query", key));
  const mergeOptions: Query["mergeOptions"] = (options) => {
    return {
      query: document,
      fetchPolicy,
      variables: { ...defaultVariables, ...options?.variables },
      context: { ...defaultContext, ...options?.context },
    };
  };

  const query: Query = {
    type: "query" as const,
    document,
    mergeOptions,
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
            (Array.isArray(when) ? when : [when]).forEach((listenable) => {
              removeListener(listenable(client, doEvicting));
            });
          }

          if (refetchOptions) {
            const { when, variables } = refetchOptions;

            const doRefetching = () => {
              refetchQuery(client, { ...mergeOptions({ variables }) });
            };

            (Array.isArray(when) ? when : [when]).forEach((listenable) => {
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

export { createQuery };
