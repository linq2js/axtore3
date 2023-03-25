import {
  AddD,
  AddV,
  AllD,
  FilterType,
  RemoveD,
  RemoveV,
  ToggleD,
  ToggleV,
  UpdateD,
  UpdateV,
  definitions,
} from "./types";
import { atom, delay, mutation, query } from "axtore";

const Token = atom(0);
const Filter = atom<FilterType>("all");
const All = query<void, AllD>(definitions, {
  operation: "All",
});

const TodoType = { name: "Todo" };

const Filtered = query(
  "filtered",
  async (args: void, { get }) => {
    const filter = get(Filter);
    const { all } = await get(All);
    const list = [...all];

    if (filter === "completed") {
      return list.filter((x) => x.completed);
    }

    if (filter === "active") {
      return list.filter((x) => !x.completed);
    }

    return list;
  },
  { type: TodoType }
);

const Add = mutation<AddV, AddD>(definitions, { operation: "Add" });

const Update = mutation<UpdateV, UpdateD>(definitions, { operation: "Update" });

const Remove = mutation<RemoveV, RemoveD>(definitions, { operation: "Remove" });

const Toggle = mutation<ToggleV, ToggleD>(definitions, { operation: "Toggle" });

const Login = mutation("login", async (args: { userId: number }, { set }) => {
  // fake delaying effect
  await delay(1000);

  set(Token, { data: args.userId });
});

const Logout = mutation("logout", (_: void, { set }) => {
  set(Token, { data: 0 });
});

const ChangeFilter = mutation(
  "changeFilter",
  (args: { filter: FilterType }, { set }) => {
    set(Filter, { data: args.filter });
  }
);

const Ping = query<void, { ping: string }>(definitions, { operation: "Ping" });

export {
  Token,
  ChangeFilter,
  Login,
  Logout,
  Add,
  Remove,
  Toggle,
  Update,
  Filter,
  Filtered,
  Ping,
};
