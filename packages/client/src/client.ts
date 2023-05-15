import { ApolloClient, HttpLink, InMemoryCache, from } from "@apollo/client";

import { onError } from "@apollo/client/link/error";
import { setContext } from "@apollo/client/link/context";

const authorizationLink = setContext((_, prev) => {
  return {
    ...prev,
    headers: {
      ...prev.headers,
      // authorization: TokenAtom.use(client).get(),
    },
  };
});
const errorLink = onError((error) => {
  console.log(error);
});
const httpLink = new HttpLink({ uri: "http://localhost:4000/" });
const link = from([errorLink, authorizationLink, httpLink]);
const cache = new InMemoryCache();
const client = new ApolloClient({
  cache,
  link,
  resolvers: {
    Query: {
      async posts(_, args: { term: string }) {
        const posts = await fetch(
          "https://jsonplaceholder.typicode.com/posts"
        ).then((res) => res.json());

        return posts.filter((x: any) => x.body.indexOf(args.term) !== -1);
      },
    },
  },
});

export { client };
