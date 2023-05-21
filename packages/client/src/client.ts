import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";

import { onError } from "@apollo/client/link/error";
import { setContext } from "@apollo/client/link/context";
import { SearchTerm } from "./types";
import { delay } from "axtore";
import { RestLink } from "axtore/rest";

const authorizationLink = setContext((_, prev) => {
  return {
    ...prev,
    headers: {
      ...prev.headers,
      // authorization: TokenAtom.use(client).get(),
    },
  };
});
const restLink = new RestLink({
  baseUrl: "https://jsonplaceholder.typicode.com",
});
const errorLink = onError((error) => {
  console.log("errorLink", error);
});
const httpLink = new HttpLink({ uri: "http://localhost:4000/" });
const link = from([errorLink, authorizationLink, restLink, httpLink]);
const cache = new InMemoryCache();

const client = new ApolloClient({
  cache,
  link,
  defaultOptions: {},
  resolvers: {
    Query: {
      async posts(_, { term }: { term: SearchTerm }) {
        await delay(300);
        const posts = await fetch(
          "https://jsonplaceholder.typicode.com/posts"
        ).then((res) => res.json());

        return posts.filter(
          (x: any) =>
            (!term.userId || x.userId === term.userId) &&
            (!term.text || x[term.searchIn]?.indexOf?.(term.text) !== -1)
        );
      },
    },
  },
});

export { client };
