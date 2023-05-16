import type { ApolloQueryResult, ObservableQuery } from "@apollo/client";

const subscribeQueryChangeEvent = (
  observableQuery: ObservableQuery,
  callback: (result: ApolloQueryResult<any>) => void,
  once: boolean
) => {
  let prevData = observableQuery.getCurrentResult().data;
  const subscription = observableQuery.subscribe((result) => {
    if (
      result.error ||
      result.loading ||
      prevData === observableQuery.getCurrentResult().data
    ) {
      return;
    }
    if (once) subscription.unsubscribe();
    prevData === observableQuery.getCurrentResult().data;
    callback(result);
  });
  return () => subscription.unsubscribe();
};

export { subscribeQueryChangeEvent };
