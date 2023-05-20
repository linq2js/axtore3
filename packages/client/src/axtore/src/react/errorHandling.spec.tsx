import { createModel } from "../createModel";
import { createHooks } from ".";
import { rest } from "../rest";
import { delay } from "../util";
import React, { ReactNode, Suspense, useState } from "react";
import { ApolloError } from "@apollo/client";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { cleanFetchMocking, createClient, createWrapper } from "../test";
import { Client } from "../types";
import { render } from "@testing-library/react";

type ErrorType = "query" | "http";
type ErrorArgs = { type: ErrorType };

const QUERY_ERROR = "QUERY_ERROR";
const NO_ERROR = "NO_ERROR";
const HTTP_ERROR = "Only absolute URLs are supported";

cleanFetchMocking();

const model = createModel({ context: { rest } })
  .query("http", ({ rest }) => rest("invalidPath"))
  .query("hasError", async ({ $http }, args: { type: "query" | "http" }) => {
    if (args.type === "http") {
      return $http();
    }
    throw new Error(QUERY_ERROR);
  });

const { useHasError } = createHooks(model.meta);

const HandleErrorByOnError = (props: ErrorArgs) => {
  const [error, setError] = useState<ApolloError>();

  useHasError({ variables: props, onError: setError });

  return <div>{error?.message ?? NO_ERROR}</div>;
};

const HandleErrorByQueryResult = (props: ErrorArgs) => {
  const result = useHasError({ variables: props });

  return <div>{result.error?.message ?? NO_ERROR}</div>;
};

const HandleErrorByErrorBoundary = (props: ErrorArgs) => {
  // when using wait() method, if the query success, it returns query data,
  // otherwise it throws query error and ErrorBoundary component will handles that error
  useHasError({ variables: props }).wait();
  return <div>{NO_ERROR}</div>;
};

const ErrorMessage = ({ error }: FallbackProps) => {
  return <div>{error.message}</div>;
};

const renderApp = (app: ReactNode, client: Client = createClient()) => {
  const Wrapper = createWrapper(client);
  return render(
    <Wrapper>
      <Suspense fallback={<div data-testid="loading" />}>{app}</Suspense>
    </Wrapper>
  );
};

const createTestCases = (type: ErrorType, message: string) => {
  test("boundary", async () => {
    const { getByText } = renderApp(
      <ErrorBoundary fallbackRender={ErrorMessage}>
        <HandleErrorByErrorBoundary type={type} />
      </ErrorBoundary>
    );

    await delay(500);
    getByText(message);
  });

  test("result", async () => {
    const { getByText } = renderApp(<HandleErrorByQueryResult type={type} />);

    await delay(500);
    getByText(message);
  });

  test("event", async () => {
    const { getByText } = renderApp(<HandleErrorByOnError type={type} />);

    await delay(200);
    getByText(message);
  });
};

describe("query", () => {
  createTestCases("query", QUERY_ERROR);
});

describe("http", () => {
  createTestCases("http", HTTP_ERROR);
});
