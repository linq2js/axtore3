import { UriFunction } from "@apollo/client";

export interface HttpOptions {
  /**
   * The URI to use when fetching operations.
   *
   * Defaults to '/graphql'.
   */
  uri?: string | UriFunction;

  /**
   * Passes the extensions field to your graphql server.
   *
   * Defaults to false.
   */
  includeExtensions?: boolean;

  /**
   * A `fetch`-compatible API to use when making requests.
   */
  fetch?: WindowOrWorkerGlobalScope["fetch"];

  /**
   * An object representing values to be sent as headers on the request.
   */
  headers?: any;

  /**
   * The credentials policy you want to use for the fetch call.
   */
  credentials?: string;

  /**
   * Any overrides of the fetch options argument to pass to the fetch call.
   */
  fetchOptions?: any;

  /**
   * If set to true, use the HTTP GET method for query operations. Mutations
   * will still use the method specified in fetchOptions.method (which defaults
   * to POST).
   */
  useGETForQueries?: boolean;

  /**
   * If set to true, the default behavior of stripping unused variables
   * from the request will be disabled.
   *
   * Unused variables are likely to trigger server-side validation errors,
   * per https://spec.graphql.org/draft/#sec-All-Variables-Used, but this
   * includeUnusedVariables option can be useful if your server deviates
   * from the GraphQL specification by not strictly enforcing that rule.
   */
  includeUnusedVariables?: boolean;
}

export type RestOptions = {
  path: string;
  method?: string;
  params?: URLSearchParams | Record<string, any>;
  body?: unknown;
  headers?: Record<string, string>;
  fieldName?: string;
  /**
   * indicate API type
   */
  type?: string;
} & Omit<RequestInit, "headers" | "body" | "method">;
