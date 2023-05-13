import { TokenAtom } from "logic/atoms/TokenAtom";
import { mutation } from "axtore";

const LoginMutation = mutation(
  "login",
  async (args: { userId: number }, { set }) => {
    set(TokenAtom, { data: args.userId });
  }
);

export { LoginMutation };
