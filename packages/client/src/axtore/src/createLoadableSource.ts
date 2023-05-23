import type { Loadable, LoadableSource } from "./types";

export type LoadableSourceOptions = {
  preload?: boolean;
};

export type CreateLoadableSource = {
  <T>(
    factory: () => Promise<T>,
    options?: LoadableSourceOptions
  ): LoadableSource<T extends { default: infer D } ? D : T>;
  <T, R>(
    factory: () => Promise<T>,
    resolve: (data: T) => R,
    options?: LoadableSourceOptions
  ): LoadableSource<R>;
};

const defaultResolveFn = (data: unknown) =>
  data && typeof data === "object" && "default" in data ? data.default : data;

const createLoadableSource: CreateLoadableSource = (
  loader: () => Promise<any>,
  ...args: any[]
) => {
  const [resolve, options = {}]: [Function, LoadableSourceOptions | undefined] =
    typeof args[0] === "function"
      ? [args[0], args[1]]
      : [defaultResolveFn, args[0]];

  let loadable: Loadable | undefined;

  const getLoadable = () => {
    if (!loadable) {
      const promise = Promise.resolve(loader())
        .then((data: any) => {
          data = resolve(data);
          loadable && Object.assign(loadable, { loading: false, data });

          return data;
        })
        .catch((error) => {
          loadable && Object.assign(loadable, { loading: false, error });
          throw error;
        });

      loadable = {
        __type: "loadable" as const,
        loading: true,
        error: undefined,
        data: undefined,
        promise,
        then: promise.then.bind(promise.then),
      };
    }

    return loadable;
  };

  const invalidate = () => {
    loadable = undefined;
    if (options.preload) {
      getLoadable();
    }
  };

  invalidate();

  return Object.assign(getLoadable, { invalidate });
};

export { createLoadableSource };
