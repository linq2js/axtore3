import {
  AddD,
  AddV,
  AllD,
  FilterType,
  RemoveD,
  RemoveV,
  Todo,
  ToggleD,
  ToggleV,
  UpdateD,
  UpdateV,
  definitions,
} from "./types";
import {
  Condition,
  atom,
  changed,
  cond,
  delay,
  every,
  mutation,
  query,
} from "axtore";

const isLoggedIn: Condition = ({ get }) => get(Token) > 0;

const Token = atom(0);
const NewTodo = atom<Todo | undefined>(undefined);
const Filter = atom<FilterType>("all");
const All = query<void, AllD>(definitions, {
  operation: "All",
  // when Token changed, do evicting on `all` field of the query
  evict: {
    when: changed(Token),
  },
  // do re-fetching after 5s if user is logged in
  refetch: {
    when: cond(isLoggedIn, every(5000)),
  },
});

const TodoType = { name: "Todo" };

const Filtered = query(
  "filtered",
  async (args: void, { get }) => {
    const filter = get(Filter);
    const newTodo = get(NewTodo);
    const { all } = await get(All);
    const list = [...all];

    // if the newTodo is not in the raw todo list, just append it
    if (newTodo && !list.find((x) => x.id === newTodo.id)) {
      list.push(newTodo);
    }

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

const AddServer = mutation<AddV, AddD>(definitions, { operation: "Add" });

const Add = mutation("add", async (args: AddV, { call, set }) => {
  set(NewTodo, { data: args.input });
  await call(AddServer, { variables: args });
});

const UpdateServer = mutation<UpdateV, UpdateD>(definitions, {
  operation: "Update",
});

const Update = mutation("update", async (args: UpdateV, { call, set }) => {
  // do optimistic update
  set("Todo", args.id, args.input);
  const result = await call(UpdateServer, { variables: args });
  alert(`Todo ${args.id} is actual updated`);
  return result.update;
});

const RemoveServer = mutation<RemoveV, RemoveD>(definitions, {
  operation: "Remove",
});

const Remove = mutation(
  "remove",
  async (args: { id: number }, { call, evict }) => {
    // do optimistic update before server call
    evict("Todo", args.id);
    // call server mutation
    const result = await call(RemoveServer, { variables: args });
    alert(`Todo ${args.id} is actual deleted`);
    return result.remove;
  }
);

const Toggle = mutation<ToggleV, ToggleD>(definitions, {
  operation: "Toggle",
});

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
