import type { RootResolver } from "../types";

import { REST_OPERATION_NAME } from "./restLink";
import type { RestOptions } from "./types";
import { generateName } from "../generateName";
import { gql } from "../util";

export type OptionsOrOptionsBuilder<TOptions, TVariables> =
  | TOptions
  | ((variables: TVariables) => TOptions);

export type RestResolver<TVariables = any, TData = any> = RootResolver<
  any,
  TVariables,
  TData
> & {
  map<TNewData>(
    mapper: (data: TData) => TNewData
  ): RestResolver<TVariables, TNewData>;
};

export type Rest = {
  <TVariables = any, TData = any>(
    path: string,
    options?: OptionsOrOptionsBuilder<Omit<RestOptions, "path">, TVariables>
  ): RestResolver<TVariables, TData>;

  <TVariables = any, TData = any>(
    method: string,
    path: string,
    options?: OptionsOrOptionsBuilder<
      Omit<RestOptions, "path" | "method">,
      TVariables
    >
  ): RestResolver<TVariables, TData>;

  <TVariables = any, TData = any>(
    options: RestOptions | ((variables: TVariables) => RestOptions)
  ): RestResolver<TVariables, TData>;
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

const createRestResolverInternal = (resolver: RootResolver<any, any, any>) => {
  return Object.assign(resolver, {
    map(mapper: Function) {
      return createRestResolverInternal(async (...args: any[]) => {
        const result = await (resolver as Function)(...args);
        return mapper(result);
      });
    },
  });
};

const createRestResolver: Rest = (...args: any[]): RestResolver => {
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
  const resolver = async (args: any, context: any) => {
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

  return createRestResolverInternal(resolver);
};

export { createRestResolver };
