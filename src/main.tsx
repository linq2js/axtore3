import "./index.css";

import {
  ApolloClient,
  ApolloProvider,
  HttpLink,
  InMemoryCache,
  from,
} from "@apollo/client";
import React, { Suspense } from "react";

import App from "./App";
import ReactDOM from "react-dom/client";
import { setContext } from "@apollo/client/link/context";
import { store } from "./store";

const AuthorizationLink = setContext((_, { headers }) => {
  return {
    headers: {
      // keep previous headers
      ...headers,
      // override authorization header
      authorization: store.defs.Token.use(client).get(),
    },
  };
});

const client = new ApolloClient({
  link: from([
    AuthorizationLink,
    new HttpLink({ uri: "http://localhost:4000/" }),
  ]),
  cache: new InMemoryCache(),
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <Suspense fallback={<div>Loading...</div>}>
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </Suspense>
);
