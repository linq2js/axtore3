import { getQueryDefinition } from "@apollo/client/utilities";
import { Kind } from "graphql";
import { getSessionManager } from "./getSessionManager";
import type { Client, Query } from "./types";

const evictQuery = (client: Client, query: Query, variables: any = {}) => {
  const options = query.mergeOptions({ variables });
  const data = client.readQuery(options);
  if (data) {
    const definition = getQueryDefinition(query.document);
    definition.selectionSet.selections.forEach((x) => {
      if (x.kind !== Kind.FIELD) return;
      client.cache.evict({
        id: "ROOT_QUERY",
        fieldName: x.name.value,
        // broadcast: true,
        args: options.variables,
      });
    });
    getSessionManager(client, query.document, options.variables).dispose();
    client.cache.gc();
  }
};

export { evictQuery };
