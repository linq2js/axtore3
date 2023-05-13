import { useCallback, useRef } from "react";

import { MutationContext } from "../types";
import { run } from "../resolver";
import { useApolloClient } from "@apollo/client";

const useMutationCallback = <T, A extends any[]>(
  callback: (context: MutationContext, ...args: A) => T
): ((...args: A) => T) => {
  const client = useApolloClient();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    (...args: A) => {
      return run(client, (context) => callbackRef.current(context, ...args));
    },
    [client]
  );
};

export { useMutationCallback };
