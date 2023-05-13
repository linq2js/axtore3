import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";

import { TokenAtom } from "logic/atoms/TokenAtom";
import { onError } from "@apollo/client/link/error";
import { setContext } from "@apollo/client/link/context";

const authorizationLink = setContext((_, prev) => {
  return {
    ...prev,
    headers: {
      ...prev.headers,
      authorization: TokenAtom.use(client).get(),
    },
  };
});
const errorLink = onError((error) => {
  console.log(error);
});
const httpLink = new HttpLink({ uri: "http://localhost:4000/" });
const link = from([errorLink, authorizationLink, httpLink]);
const cache = new InMemoryCache();
const client = new ApolloClient({ cache, link });

export { client };
