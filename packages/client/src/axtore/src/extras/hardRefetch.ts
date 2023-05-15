import { ENABLE_HARD_REFETCH } from "../createModel";
import { ContextBase } from "../types";

const hardRefresh = ({ data }: ContextBase) => {
  data[ENABLE_HARD_REFETCH] = true;
};

export { hardRefresh };
