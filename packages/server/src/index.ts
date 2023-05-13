import { server } from "./server";
import { startStandaloneServer } from "@apollo/server/standalone";

startStandaloneServer(server, {
  listen: { port: 4000 },
  async context({ req }) {
    return {
      userId: parseInt(req.headers.authorization ?? "", 10) ?? undefined,
    };
  },
}).then(({ url }) => console.log(`🚀  Server ready at: ${url}`));
