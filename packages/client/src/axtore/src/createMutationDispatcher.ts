import { Client, Mutation } from "./types";
import { handleFetchResult, wrapVariables } from "./util";

const createMutationDispatcher = <TVariables, TData>(
  client: Client,
  mutation: Mutation<TVariables, TData>,
  contextProxy: any
) => {
  const fetch = async (variables: any) => {
    return handleFetchResult(
      await client.mutate({
        mutation: mutation.document,
        variables: wrapVariables(!!mutation.resolver, variables),
      })
    );
  };

  return Object.assign(fetch, {
    resolve(variables: any) {
      if (mutation.resolver) {
        return mutation.resolver(variables, contextProxy);
      }
      return fetch(variables);
    },
  });
};

export { createMutationDispatcher };
