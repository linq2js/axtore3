import { DocumentNode } from "graphql";
import { Client, Session } from "./types";
import { isLazy } from "./util";

const handleLazyResult = <T extends "query" | "type">(
  client: Client,
  session: Session,
  type: T,
  getInfo: () => T extends "query"
    ? { query: DocumentNode; variables?: any }
    : string | undefined,
  field: string,
  result: any
) => {
  if (!isLazy(result)) return result;
  let id: string | undefined;
  const updateData = (data: any) => {
    if (!session.isActive) return;

    if (type === "query") {
      const options = getInfo() as any;
      client.writeQuery({
        ...options,
        id: "ROOT_QUERY",
        data: { [field]: data },
        broadcast: true,
        overwrite: true,
      });
    } else {
      if (!id) {
        id = getInfo() as string;
      }
      client.cache.modify({
        id,
        fields: {
          [field]: () => data,
        },
        broadcast: true,
      });
    }
  };

  session.manager.onLoad(() => {
    Promise.resolve(result.loader()).then((data) => {
      updateData(data);
      if (result.options.interval) {
        const timer = setInterval(() => {
          Promise.resolve(result.loader()).then(updateData);
        }, result.options.interval);
        session.manager.onDispose(() => {
          clearInterval(timer);
        });
      }
    });
  });

  return Promise.resolve(result.data());
};

export { handleLazyResult };
