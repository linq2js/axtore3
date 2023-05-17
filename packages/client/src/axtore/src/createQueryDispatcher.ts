import produce from "immer";
import { callbackGroup } from "./callbackGroup";
import { concurrency } from "./concurrency";
import { evictAllQueries } from "./evictAllQueries";
import { evictQuery } from "./evictQuery";
import { getObservableQuery } from "./getObservableQuery";
import { getSessionManager } from "./getSessionManager";
import { patchTypeIfPossible } from "./patchTypeIfPossible";
import { refetchAllQueries } from "./refetchAllQueries";
import { getQuerySubscriptionManager } from "./getQuerySubscriptionManager";
import type { Client, Query, QueryInfo, Session } from "./types";
import { handleFetchResult, untilSubscriptionNotifyingDone } from "./util";

const createQueryDispatcher = <TVariables, TData>(
  client: Client,
  query: Query<TVariables, TData>,
  session: Session,
  contextProxy: any,
  getDerivedQuery?: () => QueryInfo
) => {
  const fetch = async (variables: any, noCache: boolean = false) => {
    const oq = getObservableQuery(client, query, variables);
    const result = noCache ? await oq.refetch() : await oq.result();
    return handleFetchResult(result);
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
            getQuerySubscriptionManager(oq).onChange(() => {
              const qi = getDerivedQuery();
              if (qi.query.options.hardRefetch) {
                concurrency(
                  session.manager,
                  qi.query.options.debounce ? qi.query.options : {},
                  async () => {
                    evictQuery(client, qi.query, variables);
                  }
                );
                return;
              }

              qi.observable.refetch();
            })
          );
        });
      }
      return data;
    },
    {
      evict: Object.assign(
        (variables: any) => {
          return evictQuery(client, query, variables);
        },
        {
          all() {
            evictAllQueries(client, query);
          },
        }
      ),
      resolve(variables: any) {
        // call query resolver directly if possible
        if (query.resolver) {
          return query.resolver(variables, contextProxy);
        }
        // unless call query with no-cache fetchPolicy
        return fetch(variables, true);
      },
      refetch: Object.assign(
        async (variables: any = {}) => {
          return handleFetchResult(
            await getSessionManager(client, query.document, variables).refetch()
          );
        },
        {
          all() {
            refetchAllQueries(client, query);
          },
        }
      ),
      on(handlers: Record<string, Function>, variables: any) {
        const unsubscribe = callbackGroup();

        if (handlers.change) {
          const oq = getObservableQuery(client, query, variables);
          unsubscribe(
            getQuerySubscriptionManager(oq).onChange((result) =>
              handlers.change(result)
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
          updatedData = patchTypeIfPossible(recipe, query.options.type);
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

export { createQueryDispatcher };
