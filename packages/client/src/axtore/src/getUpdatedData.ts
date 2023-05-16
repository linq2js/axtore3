import produce from "immer";
import { UpdateRecipe } from "./types";

const getUpdatedData = <T>(
  recipe: UpdateRecipe<T>,
  getPrevData: () => T | undefined | null
) => {
  if (typeof recipe === "function") {
    let prevData = getPrevData();
    if (prevData === null) {
      prevData = undefined;
    }

    return produce(prevData, recipe as (prevData: T) => T) as T;
  }
  return recipe;
};

export { getUpdatedData };
