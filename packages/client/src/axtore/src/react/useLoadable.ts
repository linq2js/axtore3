import { useEffect, useMemo, useState } from "react";

import { Loadable } from "../types";

const useLoadable = <T>(loadableSource: () => Loadable<T>) => {
  const rerender = useState({})[1];
  const loadable = loadableSource();
  const wrappedLoadable = useMemo(() => {
    return {
      get loading() {
        return loadable.loading;
      },
      get data() {
        return loadable.data;
      },
      get error() {
        return loadable.error;
      },
      wait() {
        if (loadable.loading) {
          throw loadable.promise;
        }
        if (loadable.error) {
          throw loadable.error;
        }
        return loadable.data;
      },
    };
  }, [loadable]);

  useEffect(() => {
    let unmounted = false;
    if (loadable.loading) {
      loadable.promise.finally(() => !unmounted && rerender({}));
    }
    return () => {
      unmounted = true;
    };
  }, [loadable]);

  return wrappedLoadable;
};

export { useLoadable };
