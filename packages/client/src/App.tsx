import { ApolloProvider } from "@apollo/client";
import { Loading } from "./components/Loading";
import { FC, Suspense, useState } from "react";
import { client } from "./client";
import { App as StateMutating } from "./examples/StateMutating";
import { App as DebouncingEffect } from "./examples/DebouncingEffect";
import { App as EventHandling } from "./examples/EventHandling";
import { App as ErrorHandling } from "./examples/ErrorHandling";
import { App as LazyUpdating } from "./examples/LazyUpdating";
import { App as DataStaling } from "./examples/DataStaling";

const pages = {
  StateMutating,
  DebouncingEffect,
  EventHandling,
  ErrorHandling,
  LazyUpdating,
  DataStaling,
} as Record<string, FC>;

const pageNames = Object.keys(pages);

export default () => {
  const [selected, setPage] = useState(pageNames[0]);
  const Page = pages[selected];

  return (
    <div style={{ margin: 20 }}>
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
        <hr />
        <Suspense fallback={<Loading />}>
          <Page />
        </Suspense>
      </ApolloProvider>
    </div>
  );
};
