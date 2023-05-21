import { model } from "axtore";
import { hooks } from "axtore/react";
import { rest } from "axtore/rest";
import { FormEvent, useRef } from "react";

type Todo = { id: string; title: string; completed: boolean };
type TodoFilter = "all" | "completed" | "scheduled";

const appModel = model({ context: { rest } })
  // fetch data from server
  .query("list", async ({ rest }) => rest<Todo[]>("/todos?userId=1"))
  .state("filter", "all" as TodoFilter)
  .query("filteredList", async ({ $filter, $list }) => {
    const { list } = await $list();
    const filter = $filter();

    if (filter === "completed") return list.filter((x) => x.completed);
    if (filter === "scheduled") return list.filter((x) => !x.completed);

    return list;
  })
  .mutation("applyFilter", ({ $filter }, args: { filter: TodoFilter }) => {
    $filter(args.filter);
  })
  .mutation("add", ({ $list }, args: { title: string }) => {
    const id = Math.random().toString(16).replace(/\./g, "");

    $list.set(({ list }) => {
      list.push({
        id,
        title: args.title,
        completed: false,
      });
    });
  })
  .mutation("rename", ({ $list }, args: { id: string; title: string }) => {
    // mutate data of $list query and $filterList also react
    $list.set(({ list }) => {
      const todo = list.find((x) => x.id === args.id);
      if (todo) {
        todo.title = args.title;
      }
    });
  })
  .mutation("toggle", ({ $list }, args: { id: string }) => {
    // mutate data of $list query and $filterList also react
    $list.set(({ list }) => {
      const todo = list.find((x) => x.id === args.id);
      if (todo) {
        todo.completed = !todo.completed;
      }
    });
  })
  .mutation("remove", ({ $list }, args: { id: string }) => {
    // mutate data of $list query and $filterList also react
    $list.set(({ list }) => {
      const index = list.findIndex((x) => x.id === args.id);
      if (index !== -1) {
        list.splice(index, 1);
      }
    });
  })
  .mutation("clear", ({ $list }) => {
    $list.set(({ list }) => {
      list.length = 0;
    });
  });

const {
  useAdd,
  useRemove,
  useRename,
  useToggle,
  useClear,
  useFilter,
  useFilteredList,
  useApplyFilter,
} = hooks(appModel.meta);

const App = () => {
  const { filteredList: list } = useFilteredList().wait();
  const filter = useFilter();
  const applyFilter = useApplyFilter();
  const titleRef = useRef<HTMLInputElement>(null);
  const add = useAdd();
  const remove = useRemove();
  const rename = useRename();
  const toggle = useToggle();
  const clear = useClear();
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!titleRef.current?.value) return;
    const title = titleRef.current.value;
    titleRef.current.value = "";
    add({ title });
  };

  return (
    <>
      <blockquote>This app demonstrates mutating `query` data.</blockquote>
      <form onSubmit={handleSubmit}>
        <input ref={titleRef} type="text" placeholder="What need to be done?" />
      </form>
      <p></p>
      <p>
        Filter{" "}
        <button
          style={{ fontWeight: filter === "all" ? "bold" : "normal" }}
          onClick={() => applyFilter({ filter: "all" })}
        >
          All
        </button>
        <button
          style={{ fontWeight: filter === "scheduled" ? "bold" : "normal" }}
          onClick={() => applyFilter({ filter: "scheduled" })}
        >
          Scheduled
        </button>
        <button
          style={{ fontWeight: filter === "completed" ? "bold" : "normal" }}
          onClick={() => applyFilter({ filter: "completed" })}
        >
          Completed
        </button>
      </p>
      <div style={{ display: "flex", flexDirection: "row" }}>
        <div>
          <p>
            <strong>List:</strong>
          </p>
          <button onClick={() => clear()}>Clear</button>
          <p></p>
          {list.map((todo) => {
            return (
              <p
                key={todo.id}
                style={{
                  opacity: filter === "all" && todo.completed ? 0.5 : 1,
                }}
              >
                <input
                  type="text"
                  value={todo.title}
                  onChange={(e) =>
                    rename({ id: todo.id, title: e.currentTarget.value })
                  }
                />
                <button onClick={() => toggle({ id: todo.id })}>
                  {filter === "completed"
                    ? "Scheduled"
                    : filter === "scheduled"
                    ? "Completed"
                    : "Toggle"}
                </button>
                <button onClick={() => remove({ id: todo.id })}>Remove</button>
              </p>
            );
          })}
        </div>
        <div>
          <p>
            <strong>Data:</strong>
          </p>
          <pre>{JSON.stringify(list, null, 2)}</pre>
        </div>
      </div>
    </>
  );
};

export { App };
