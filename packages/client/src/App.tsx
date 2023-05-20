import { ApolloProvider } from "@apollo/client";
import { Loading } from "./components/Loading";
import { FC, Fragment, Suspense, useState } from "react";
import { client } from "./client";
import { App as TodoList } from "./examples/TodoList";
import { App as DebouncingEffect } from "./examples/SearchPost";
import { App as EventHandling } from "./examples/Event";
import { App as ErrorHandling } from "./examples/ErrorHandling";
import { App as LazyFetching } from "./examples/Lazy";

const pages = {
  TodoList,
  DebouncingEffect,
  EventHandling,
  ErrorHandling,
  LazyFetching,
} as Record<string, FC>;

const pageNames = Object.keys(pages);

export default () => {
  const [selected, setPage] = useState(pageNames[0]);
  const Page = pages[selected];

  return (
    <ApolloProvider client={client}>
      <p>
        Select an example{" "}
        <select onChange={(e) => setPage(e.currentTarget.value)}>
          {pageNames.map((pageName) => (
            <option value={pageName} key={pageName}>
              {pageName}
            </option>
          ))}
        </select>
      </p>
      <Suspense fallback={<Loading />}>
        <Page />
      </Suspense>
    </ApolloProvider>
  );
};
