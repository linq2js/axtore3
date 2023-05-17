import type { ApolloQueryResult, ObservableQuery } from "@apollo/client";
import { callbackGroup } from "./callbackGroup";
import { createProp } from "./util";

const SUBSCRIPTION_MANAGER_PROP = Symbol("subscriptionManager");

const getQuerySubscriptionManager = (observableQuery: ObservableQuery) => {
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

export { getQuerySubscriptionManager };
