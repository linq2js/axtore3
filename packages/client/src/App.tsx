import { ApolloProvider } from "@apollo/client";
import { Loading } from "./components/Loading";
import { Suspense } from "react";
import { client } from "./client";

const App = () => {
  return (
    <>
      <div className="p-3">asd adas</div>
    </>
  );
};

export default () => {
  return (
    <ApolloProvider client={client}>
      <Suspense fallback={<Loading />}>
        <App />
      </Suspense>
    </ApolloProvider>
  );
};
