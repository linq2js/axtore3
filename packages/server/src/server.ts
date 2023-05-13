import { ApolloServer } from "@apollo/server";
import { loadFile } from "graphql-import-files";
import { resolvers } from "./resolvers";

const server = new ApolloServer({
  typeDefs: loadFile("./src/schema.gql"),
  resolvers,
});

export { server };
