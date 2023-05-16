import { model } from "axtore";
import { createHooks } from "axtore/react";
import { FormEvent, useMemo, useRef } from "react";

type Todo = { id: string; title: string };

const appModel = model()
  .state("list", {} as Record<string, Todo>)
  .mutation("add", (args: { title: string }, { $list }) => {
    const id = Math.random().toString(16).replace(/\./g, "");
    $list((list) => {
      list[id] = {
        id,
        title: args.title,
      };
    });
  })
  .mutation("rename", (args: { id: string; title: string }, { $list }) => {
    $list((list) => {
      list[args.id].title = args.title;
    });
  })
  .mutation("remove", (args: { id: string }, { $list }) => {
    $list((list) => {
      delete list[args.id];
    });
  })
  .mutation("clear", (args: void, { $list }) => {
    $list({});
  });

const { useAdd, useRemove, useRename, useList, useClear } = createHooks(
  appModel.meta
);

const App = () => {
  const list = useList();
  const titleRef = useRef<HTMLInputElement>(null);
  const values = useMemo(() => Object.values(list), [list]);
  const add = useAdd();
  const remove = useRemove();
  const rename = useRename();
  const clear = useClear();
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!titleRef.current?.value) return;
    const title = titleRef.current.value;
    titleRef.current.value = "";
    add.mutate({ title });
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <input ref={titleRef} type="text" />
      </form>
      <p>
        <h2>List:</h2>
        <button onClick={() => clear.mutate()}>Clear</button>
      </p>
      {values.map((todo) => {
        return (
          <p key={todo.id}>
            <input
              type="text"
              value={todo.title}
              onChange={(e) =>
                rename.mutate({ id: todo.id, title: e.currentTarget.value })
              }
            />
            <button onClick={() => remove.mutate({ id: todo.id })}>
              Remove
            </button>
          </p>
        );
      })}
      <h2>Data:</h2>
      <pre>{JSON.stringify(list, null, 2)}</pre>
    </>
  );
};

export { App };
