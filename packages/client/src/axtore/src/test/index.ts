import {
  ApolloClient,
  ApolloClientOptions,
  ApolloLink,
  ApolloProvider,
  HttpLink,
  InMemoryCache,
  from,
} from "@apollo/client";
import { FetchMockStatic, MockRequest } from "fetch-mock";
import { PropsWithChildren, createElement } from "react";
import { RestLink, RestLinkOptions } from "../rest/restLink";
import { delay, isFunction } from "../util";

import { Client } from "../types";
import fetch from "cross-fetch";

const fetchMock = require("fetch-mock") as FetchMockStatic;

global.fetch = fetch;

type Nullable = void | undefined | null;
type MockHandler =
  | ((
      args: Record<string, any>,
      operationName: string,
      req: MockRequest
    ) => {} | Nullable | Promise<{} | Nullable>)
  | {};

const DEFAULT_GRAPHQL_URI = "/graphql";
const DEFAULT_REST_URI = "/api";

const createClient = (
  options?: Omit<ApolloClientOptions<unknown>, "cache"> & {
    uri?: string;
    mock?: MockHandler[] | Record<string, any>;
    delay?: number;
    rest?: boolean | RestLinkOptions;
  }
) => {
  const {
    uri: graphqlUri = DEFAULT_GRAPHQL_URI,
    rest,
    mock,
    delay: delayTime,
    ...otherOptions
  } = options || {};
  const restUri =
    typeof rest === "object"
      ? rest.baseUrl || DEFAULT_GRAPHQL_URI
      : rest
      ? DEFAULT_REST_URI
      : undefined;

  if (mock) {
    registerFetchMocking(
      {
        graphql: graphqlUri,
        rest: true,
      },
      mock
    );
  }

  const links: ApolloLink[] = [
    new HttpLink({
      uri: graphqlUri,
      fetch: mock ? undefined : fetch,
    }),
  ];

  if (rest) {
    links.unshift(
      new RestLink({
        ...(typeof rest !== "boolean" ? rest : {}),
        baseUrl: restUri ?? DEFAULT_REST_URI,
        fetch: mock ? undefined : fetch,
      })
    );
  }

  const cache = new InMemoryCache();
  const client = new ApolloClient({
    ...otherOptions,
    link: options?.link ?? from(links),
    cache,
  });

  return client;
};

const registerFetchMocking = (
  uris: { graphql?: string; rest?: boolean },
  handler: MockHandler[] | Record<string, any>,
  delayTime?: number
) => {
  const mockFn = async (isGraphql: boolean, url: string, req: MockRequest) => {
    if (delayTime) {
      await delay(delayTime);
    }

    const json = req.body ? JSON.parse(req.body as string) : {};
    const {
      variables: args = !isGraphql ? json : undefined,
      operationName = !isGraphql ? url : undefined,
    } = json;
    console.log(`[${isGraphql ? "graphql" : "rest"}-call-request]`, url, json);

    if (!Array.isArray(handler)) {
      return handler[operationName];
    }

    const mockingCopy = handler.slice();

    let response: any;

    try {
      while (mockingCopy.length) {
        const mock = mockingCopy.pop();
        const data = isFunction(mock)
          ? await mock?.(args, operationName, req)
          : mock;
        if (!data) continue;
        response = isGraphql ? { data } : data;
        break;
      }
    } catch (ex) {
      return { errors: [ex] };
    }
    console.log(
      `[${isGraphql ? "graphql" : "rest"}-call-response]`,
      url,
      response
    );
    return response;
  };

  if (uris.graphql) {
    fetchMock.post(uris.graphql, (...args) => mockFn(true, ...args));
  }

  if (uris.rest) {
    fetchMock.mock(
      (url) => url !== uris.graphql,
      (url, req) => mockFn(false, url, req)
    );
  }
};

const createWrapper = (client: Client) => {
  return (props: PropsWithChildren<{}>) =>
    createElement(ApolloProvider, { client, children: props.children });
};

const cleanFetchMocking = () => {
  afterEach(() => {
    fetchMock.restore();
  });
};

const enableAsyncTesting = () => {
  const originalError = console.error;

  beforeEach(() => {
    console.error = (...args: any[]) => {
      if (/Warning.*not wrapped in act/.test(args[0])) {
        return;
      }

      originalError.call(console, ...args);
    };
  });

  afterEach(() => {
    console.error = originalError;
  });

  cleanFetchMocking();
};

export {
  DEFAULT_GRAPHQL_URI,
  DEFAULT_REST_URI,
  createClient,
  createWrapper,
  enableAsyncTesting,
  cleanFetchMocking,
  registerFetchMocking,
};
