import { ContextBase } from "../types";
import gql from "graphql-tag";
import { generateName } from "../generateName";
import { REST_OPERATION_NAME } from "./restLink";
import { RestOptions } from "./types";

export type RestDispatcher = {
  <TData = any>(
    path: string,
    options?: Omit<RestOptions, "path">
  ): Promise<TData>;

  <TData = any>(
    method: string,
    path: string,
    options?: Omit<RestOptions, "path" | "method">
  ): Promise<TData>;

  <TData = any>(options: RestOptions): Promise<TData>;
};

const createOptionsBuilder = (
  customOptions?: RestOptions | ((variables: unknown) => RestOptions),
  defaultOptions?: RestOptions
) => {
  return (variables: unknown) => {
    return {
      ...defaultOptions,
      ...(typeof customOptions === "function"
        ? customOptions?.(variables)
        : customOptions),
    };
  };
};

const createRestDispatcher = Object.assign(
  ({ context, client }: ContextBase): RestDispatcher =>
    async (...args: any[]) => {
      const [customOptions, defaultOptions]: [
        RestOptions | undefined,
        RestOptions | undefined
      ] =
        // rest(method, path, options?)
        // rest(path, options?)
        typeof args[0] === "string"
          ? // rest(method, path, options?)
            typeof args[1] === "string"
            ? [args[2], { method: args[0], path: args[1] }]
            : // rest(path, options?)
              [args[1], { method: "get", path: args[0] }]
          : // rest(options)
            [args[0], undefined];
      const fieldName = generateName("query");
      const restQuery = gql`
        query ${REST_OPERATION_NAME} {
          ${fieldName}
        }
      `;

      const optionsBuilder = createOptionsBuilder(
        customOptions,
        defaultOptions
      );

      const result = await client.query({
        query: restQuery,
        fetchPolicy: "network-only",
        context: {
          ...context,
          restOptions: {
            fieldName,
            ...optionsBuilder(args),
          },
        },
      });

      // remove cached data
      client.cache.evict({ id: "ROOT_QUERY", fieldName });

      if (result.error) {
        throw result.error;
      }
      return result.data[fieldName];
    },
  { type: "dispatcher" as const }
);

export { createRestDispatcher };
