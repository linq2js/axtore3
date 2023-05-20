import type { HttpOptions, Observer } from "@apollo/client";

import {
  Observable,
  ApolloLink,
  checkFetcher,
  createSignalIfSupported,
} from "@apollo/client";

import type { RestOptions } from "./types";

export type DefaultRestOptions = Partial<Omit<RestOptions, "path">>;

export type PerRequestOptionsBuilder = () =>
  | DefaultRestOptions
  | Promise<DefaultRestOptions>;

export type DefaultRestOptionsBuilder = () =>
  | DefaultRestOptions
  | Promise<DefaultRestOptions>
  | PerRequestOptionsBuilder;

export type ResponseTransformer = (
  data: any,
  type: string,
  context: any
) => any;

export type RestLinkOptions = {
  baseUrl: string;
  fetch?: HttpOptions["fetch"];
  matcher?: string | string[] | ((type: string, context: any) => boolean);
  /**
   *
   */
  options?: DefaultRestOptions | DefaultRestOptionsBuilder;
  transform?: ResponseTransformer;
};

const REST_OPERATION_NAME = "__REST_OPERATION__";

const __DEV__ = process.env.NODE_ENV !== "production";

function maybe<T>(thunk: () => T): T | undefined {
  try {
    return thunk();
  } catch {}
  return undefined;
}

const handleError = (err: any, observer: Observer<any>) => {
  if (err.name === "AbortError") return;
  // if it is a network error, BUT there is graphql result info fire
  // the next observer before calling error this gives apollo-client
  // (and react-apollo) the `graphqlErrors` and `networkErrors` to
  // pass to UI this should only happen if we *also* have data as
  // part of the response key per the spec
  if (err.result && err.result.errors && err.result.data) {
    // if we don't call next, the UI can only show networkError
    // because AC didn't get any graphqlErrors this is graphql
    // execution result info (i.e errors and possibly data) this is
    // because there is no formal spec how errors should translate to
    // http status codes. So an auth error (401) could have both data
    // from a public field, errors from a private field, and a status
    // of 401
    // {
    //  user { // this will have errors
    //    firstName
    //  }
    //  products { // this is public so will have data
    //    cost
    //  }
    // }
    //
    // the result of above *could* look like this:
    // {
    //   data: { products: [{ cost: "$10" }] },
    //   errors: [{
    //      message: 'your session has timed out',
    //      path: []
    //   }]
    // }
    // status code of above would be a 401
    // in the UI you want to show data where you can, errors as data where you can
    // and use correct http status codes
    observer.next?.(err.result);
  }

  observer.error?.(err);
};

const backupFetch = maybe(() => fetch);

const createRestLink = (options: RestLinkOptions) => {
  const {
    baseUrl,
    // use default global fetch if nothing passed in
    fetch: preferredFetch,
    matcher,
    options: defaultOptions,
    transform,
  } = options;
  const matcherFn = !matcher
    ? undefined
    : typeof matcher === "function"
    ? matcher
    : (type: string) =>
        Array.isArray(matcher) ? matcher.includes(type) : matcher === type;

  if (__DEV__) {
    // Make sure at least one of preferredFetch, window.fetch, or backupFetch is
    // defined, so requests won't fail at runtime.
    checkFetcher(preferredFetch || backupFetch);
  }

  let perRequestOptionsBuilder: PerRequestOptionsBuilder | undefined;

  const getOptions = async (restOptions: RestOptions) => {
    if (!perRequestOptionsBuilder) {
      const result =
        typeof defaultOptions === "function"
          ? defaultOptions()
          : defaultOptions;

      if (typeof result === "function") {
        perRequestOptionsBuilder = result;
      } else {
        const options = await result;
        perRequestOptionsBuilder = () => options ?? {};
      }
    }
    const perRequestOptions = await perRequestOptionsBuilder();
    const mergedOptions: RestOptions = {
      ...perRequestOptions,
      ...restOptions,
      headers: {
        ...perRequestOptions.headers,
        ...restOptions.headers,
      },
      params: {
        ...perRequestOptions.params,
        ...restOptions.params,
      },
    };

    return mergedOptions;
  };

  return new ApolloLink((operation, forward) => {
    const context = operation.getContext();
    const restOptions = (context.restOptions as RestOptions) || {};
    const restType = restOptions.type ?? "";

    if (operation.operationName === REST_OPERATION_NAME) {
      if (matcherFn && !matcherFn(restType, context)) {
        return forward(operation);
      }

      return new Observable((observer) => {
        // Prefer linkOptions.fetch (preferredFetch) if provided, and otherwise
        // fall back to the *current* global window.fetch function (see issue
        // #7832), or (if all else fails) the backupFetch function we saved when
        // this module was first evaluated. This last option protects against the
        // removal of window.fetch, which is unlikely but not impossible.
        const currentFetch =
          preferredFetch || maybe(() => fetch) || backupFetch;

        let controller: any;

        Promise.resolve(
          getOptions({
            ...restOptions,
            headers: {
              ...context.headers,
              ...restOptions.headers,
            },
          })
        )
          .then(async (mergedRestOptions) => {
            // `apollographql-client-*` headers are automatically set if a
            // `clientAwareness` object is found in the context. These headers are
            // set first, followed by the rest of the headers pulled from
            // `context.headers`. If desired, `apollographql-client-*` headers set by
            // the `clientAwareness` object can be overridden by
            // `apollographql-client-*` headers set in `context.headers`.
            const clientAwarenessHeaders: {
              "apollographql-client-name"?: string;
              "apollographql-client-version"?: string;
            } = {};

            if (context.clientAwareness) {
              const { name, version } = context.clientAwareness;
              if (name) {
                clientAwarenessHeaders["apollographql-client-name"] = name;
              }
              if (version) {
                clientAwarenessHeaders["apollographql-client-version"] =
                  version;
              }
            }

            let chosenURI = baseUrl + (mergedRestOptions.path || "");
            const method = mergedRestOptions.method
              ? mergedRestOptions.method.toUpperCase()
              : "GET";
            const headers = {
              ...clientAwarenessHeaders,
              ...mergedRestOptions.headers,
            };
            const body =
              mergedRestOptions.body &&
              mergedRestOptions.body instanceof FormData
                ? mergedRestOptions.body
                : typeof mergedRestOptions.body !== "undefined" &&
                  mergedRestOptions.body !== null
                ? JSON.stringify(mergedRestOptions.body)
                : mergedRestOptions.body;

            if (!mergedRestOptions.signal) {
              const { controller: _controller, signal } =
                createSignalIfSupported();
              controller = _controller;
              if (controller && typeof signal !== "boolean") {
                mergedRestOptions.signal = signal;
              }
            }

            if (
              mergedRestOptions.params &&
              Object.keys(mergedRestOptions.params ?? {}).length
            ) {
              chosenURI +=
                (chosenURI.includes("?") ? "" : "?") +
                (mergedRestOptions.params instanceof URLSearchParams
                  ? mergedRestOptions.params
                  : new URLSearchParams(mergedRestOptions.params));
            }

            const response = await currentFetch!(chosenURI, {
              ...mergedRestOptions,
              method,
              headers,
              body,
            });
            operation.setContext({ response });
            let data = await response.json();

            if (transform) {
              data = transform(data, restType, context);
            }

            observer.next({
              data: { [mergedRestOptions.fieldName as string]: data },
            });
            observer.complete();
          })
          .catch((err) => {
            handleError(err, observer);
          });

        return () => {
          // XXX support canceling this request
          // https://developers.google.com/web/updates/2017/09/abortable-fetch
          if (controller) controller.abort();
        };
      });
    }

    return forward(operation);
  });
};

class RestLink extends ApolloLink {
  constructor(public options: RestLinkOptions) {
    super(createRestLink(options).request);
  }
}

export { REST_OPERATION_NAME, RestLink };
