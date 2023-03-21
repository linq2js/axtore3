import { QueryResolver, gql } from "../types";

import { REST_OPERATION_NAME } from "./RestLink";
import { RestOptions } from "./types";
import { generateName } from "../generateName";

export type OptionsOrOptionsBuilder<TOptions, TVariables> =
  | TOptions
  | ((variables: TVariables) => RestOptions);

export type Rest = {
  <TVariables = unknown>(
    path: string,
    options?: OptionsOrOptionsBuilder<Omit<RestOptions, "path">, TVariables>
  ): QueryResolver<unknown, TVariables>;
  <TVariables = unknown>(
    method: string,
    path: string,
    options?: OptionsOrOptionsBuilder<
      Omit<RestOptions, "path" | "method">,
      TVariables
    >
  ): QueryResolver<unknown, TVariables>;
  <TVariables = unknown>(
    options: RestOptions | ((variables: TVariables) => RestOptions)
  ): QueryResolver<unknown, TVariables>;
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

const createRestResolver: Rest = (...args: any[]): QueryResolver => {
  const [customOptions, defaultOptions]: [
    RestOptions | ((variables: unknown) => RestOptions) | undefined,
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

  const optionsBuilder = createOptionsBuilder(customOptions, defaultOptions);

  return async (args, context) => {
    const result = await context.client.query({
      query: restQuery,
      fetchPolicy: "network-only",
      context: {
        ...context.context,
        restOptions: {
          fieldName,
          ...optionsBuilder(args),
        },
      },
    });
    if (result.error) {
      throw result.error;
    }
    return result.data[fieldName];
  };
};

export { createRestResolver };
