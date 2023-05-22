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

let photosPromise: Promise<any[]> | undefined;

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
      async paginatedPhotos(_, { page, size }: { page: number; size: number }) {
        console.log("load photos", { page, size });
        if (!photosPromise) {
          photosPromise = fetch(
            "https://jsonplaceholder.typicode.com/photos"
          ).then((res) => res.json());
        }
        await delay(500);
        const photos = await photosPromise;
        return (
          photos
            // limit to 100 items for testing
            .slice(0, 100)
            .slice(page * size, (page + 1) * size)
        );
      },
    },
  },
});

export { client };
