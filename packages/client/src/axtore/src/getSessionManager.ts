import type { ObservableQuery } from "@apollo/client";
import { callbackGroup } from "./callbackGroup";
import { getData } from "./getData";
import type { Client, SessionManager } from "./types";

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

export { getSessionManager };
