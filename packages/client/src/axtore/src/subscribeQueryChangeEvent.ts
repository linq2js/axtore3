import type { ApolloQueryResult, ObservableQuery } from "@apollo/client";
import { callbackGroup } from "./callbackGroup";
import { createProp } from "./util";

const SUBSCRIPTION_MANAGER_PROP = Symbol("subscriptionManager");

const getSubscriptionManager = (observableQuery: ObservableQuery) => {
  const onChange = callbackGroup();
  let lastResult = observableQuery.getLastResult();

  observableQuery.subscribe((result) => {
    if (result.error || result.loading) return;
    if (lastResult?.data === result.data) return;
    lastResult = result;
    onChange.invoke(result.data);
  });

  return createProp(observableQuery, SUBSCRIPTION_MANAGER_PROP, () => {
    return {
      onChange,
    };
  });
};

const subscribeQueryChangeEvent = (
  observableQuery: ObservableQuery,
  callback: (result: ApolloQueryResult<any>) => void,
  once: boolean
) => {
  const unsubscribe = getSubscriptionManager(observableQuery).onChange(
    (result: any) => {
      if (once) unsubscribe();
      callback(result);
    }
  );
  return unsubscribe;
};

export { subscribeQueryChangeEvent, getSubscriptionManager };
