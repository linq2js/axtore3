import { getSessionManager } from "./getSessionManager";
import { Client, Query } from "./types";

const getObservableQuery = (
  client: Client,
  query: Query,
  variables: any = {}
) => {
  return getSessionManager(
    client,
    query.document,
    query.mergeOptions({ variables }).variables
  ).observableQuery;
};

export { getObservableQuery };
