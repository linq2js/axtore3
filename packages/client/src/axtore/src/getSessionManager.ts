import { callbackGroup } from "./callbackGroup";
import { getData } from "./getData";
import type { Client, EnhancedObservableQuery, SessionManager } from "./types";
import { createProp } from "./util";

const SUBSCRIPTIONS_PROP = Symbol("subscriptions");

const getSessionManager = (client: Client, group: any = {}, key: any = {}) => {
  return getData(client, group, key, () => {
    let currentToken = {};
    const data = {};
    const onDispose = callbackGroup();
    const onLoad = callbackGroup();
    let observableQuery: EnhancedObservableQuery | undefined;
    let disposed = false;

    const cleanup = () => {
      // cleanup previous session
      onDispose.invokeAndClear();
      onLoad.invokeAndClear();
    };

    const sm: SessionManager = {
      key,
      onDispose,
      onLoad,
      data,
      get observableQuery() {
        if (!observableQuery) {
          const oq = client.watchQuery({
            query: group,
            variables: key,
            notifyOnNetworkStatusChange: true,
          });

          const onChange = callbackGroup();
          const onNext = callbackGroup();
          let lastResult = oq.getLastResult();

          oq.subscribe((result) => {
            if (result.error || result.loading) return;
            if (lastResult?.data === result.data) return;
            lastResult = result;
            onNext.invoke();
            onChange.invoke(result.data);
          }, onNext.invoke);

          observableQuery = Object.assign(
            oq,
            createProp(oq, SUBSCRIPTIONS_PROP, () => {
              return {
                onChange,
                onNext,
              };
            })
          );
        }
        return observableQuery;
      },
      start() {
        disposed = false;
        let token = (currentToken = {});
        cleanup();

        return {
          get isActive() {
            return !disposed && token === currentToken;
          },
          manager: sm,
          onDispose,
        };
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        cleanup();
      },
    };
    return sm;
  });
};

export { getSessionManager };
