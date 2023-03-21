import { useApolloClient, useReactiveVar } from "@apollo/client";

import { Atom } from "../types";

const useAtom = <TData>(atom: Atom<TData>) => {
  const client = useApolloClient();
  const handler = atom.use(client);
  return useReactiveVar(handler.reactiveVar);
};

export { useAtom };
