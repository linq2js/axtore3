import { evictQuery } from "./evictQuery";
import type { Client, Query } from "./types";

const evictAllQueries = (client: Client, query: Query) => {
  client.getObservableQueries().forEach((oq) => {
    if (oq.query !== query.document) return;
    evictQuery(client, query, oq.variables);
  });
};

export { evictAllQueries };
