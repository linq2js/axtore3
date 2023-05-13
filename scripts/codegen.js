const typeConfigs = {
  plugins: [
    {
      add: {
        content: [
          "/* eslint-disable */",
          "/* This file is generated. Do not modify directly. */",
          "",
        ],
      },
    },
    "fragment-matcher",
    "typescript",
    "typescript-operations",
    "typescript-document-nodes",
  ],
  config: {
    maybeValue: "T | undefined",
    inputMaybeValue: "T | undefined",
    nameSuffix: "Document",
    operationResultSuffix: "Result",
  },
};

module.exports = {
  overwrite: true,
  schema: "packages/server/src/schema.gql",
  generates: {
    // generate graphql types for client side
    "packages/client/src/static/graphql/types.ts": {
      documents: "packages/client/**/*.gql",
      ...typeConfigs,
    },
    // generate graphql types for server side
    "packages/server/src/static/graphql/types.ts": {
      ...typeConfigs,
    },
  },
};
