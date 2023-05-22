import { ApolloError } from "@apollo/client";
import { delay, model } from "axtore";
import { hooks } from "axtore/react";
import { rest } from "axtore/rest";
import { Suspense, useState } from "react";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";

type ErrorType = "query" | "http";
type ErrorHandlingMethod = "event" | "boundary" | "result";
type ErrorArgs = { type: ErrorType };

const appModel = model()
  .use({ rest })
  .query("http", ({ $rest }) => $rest("@@@"))
  .query("hasError", async ({ $http }, args: ErrorArgs) => {
    console.log("querying");
    await delay(1000);
    if (args.type === "http") {
      return $http();
    }
    throw new Error("Query error");
  });

const { useHasError } = hooks(appModel.meta);

const HandleErrorByOnError = (props: ErrorArgs) => {
  const [error, setError] = useState<ApolloError>();

  useHasError({ variables: props, onError: setError });

  return <div>{error?.message ?? "No error"}</div>;
};

const HandleErrorByQueryResult = (props: ErrorArgs) => {
  const result = useHasError({ variables: props });

  return <div>{result.error?.message ?? "No error"}</div>;
};

const HandleErrorByErrorBoundary = (props: ErrorArgs) => {
  // when using wait() method, if the query success, it returns query data,
  // otherwise it throws query error and ErrorBoundary component will handles that error
  useHasError({ variables: props }).wait();
  return <div>No error</div>;
};

const ErrorMessage = ({ error }: FallbackProps) => {
  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre style={{ color: "red" }}>{error.message}</pre>
    </div>
  );
};

const App = () => {
  const [method, setMethod] = useState<ErrorHandlingMethod>("event");
  const [type, setType] = useState<ErrorType>("query");

  const props = { type };

  return (
    <>
      <blockquote>This app demonstrates for error handling</blockquote>
      <p>
        <select
          onChange={(e) =>
            setMethod(e.currentTarget.value as ErrorHandlingMethod)
          }
          value={method}
        >
          <option value="event">Using onError</option>
          <option value="result">Using query result</option>
          <option value="boundary">Using Error Boundary</option>
        </select>
      </p>
      <p>
        <p>
          <strong>Error type</strong>
        </p>
        <label>
          <input
            type="radio"
            name="type"
            defaultChecked={type === "query"}
            onClick={() => setType("query")}
          />{" "}
          Query
        </label>{" "}
        <label>
          <input
            type="radio"
            name="type"
            defaultChecked={type === "http"}
            onClick={() => setType("http")}
          />{" "}
          HTTP
        </label>
      </p>
      <Suspense fallback="Loading...">
        {method === "boundary" && (
          <ErrorBoundary fallbackRender={ErrorMessage} key={type}>
            <HandleErrorByErrorBoundary {...props} />
          </ErrorBoundary>
        )}
        {method === "event" && <HandleErrorByOnError {...props} />}
        {method === "result" && <HandleErrorByQueryResult {...props} />}
      </Suspense>
    </>
  );
};

export { App };
