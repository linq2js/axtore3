import type { Client, Query } from "./types";

const refetchAllQueries = (client: Client, query: Query) => {
  client.getObservableQueries().forEach((oq) => {
    if (oq.query !== query.document) return;
    oq.refetch();
  });
};

export { refetchAllQueries };
