import { TokenAtom } from "logic/atoms/TokenAtom";
import { mutation } from "axtore";

const LogoutMutation = mutation("login", async (args: void, { set }) => {
  set(TokenAtom, { data: 0 });
});

export { LogoutMutation };
