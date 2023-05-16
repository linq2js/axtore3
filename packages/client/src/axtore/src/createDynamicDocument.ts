import { gql, WRAPPED_VARIABLE_NAME } from "./util";

const createDynamicDocument = (
  type: "query" | "mutation",
  field: string,
  alias: string
) => {
  const selection = `($${WRAPPED_VARIABLE_NAME}: ${WRAPPED_VARIABLE_NAME}) {
        ${alias}:${field} (${WRAPPED_VARIABLE_NAME}: $${WRAPPED_VARIABLE_NAME}) @client
      }`;

  return gql`
    ${type}
    ${selection}
  `;
};

export { createDynamicDocument };
