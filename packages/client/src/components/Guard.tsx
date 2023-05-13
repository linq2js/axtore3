import { PropsWithChildren } from "react";
import { TokenAtom } from "logic/atoms/TokenAtom";
import { use } from "axtore/react";

export type Props = PropsWithChildren<{
  role: "guest" | "user";
}>;

const Guard = (props: Props) => {
  const token = use(TokenAtom);
  const isAuthenticated = token > 0;
  const children = <>{props.children}</>;

  if (props.role === "guest") {
    if (!isAuthenticated) {
      return children;
    }
  } else {
    if (isAuthenticated) {
      return children;
    }
  }
  return null;
};

export { Guard };
