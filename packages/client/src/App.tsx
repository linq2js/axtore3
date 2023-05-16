import { ApolloProvider } from "@apollo/client";
import { Loading } from "./components/Loading";
import { Suspense } from "react";
import { client } from "./client";
import { App } from "./examples/TodoList";

export default () => {
  return (
    <ApolloProvider client={client}>
      <Suspense fallback={<Loading />}>
        <App />
      </Suspense>
    </ApolloProvider>
  );
};
