import { model } from "axtore";
import { hooks } from "axtore/react";
import { FormEvent, useMemo, useRef } from "react";

type Todo = { id: string; title: string };

const appModel = model()
  .state("list", {} as Record<string, Todo>)
  .mutation("add", ({ $list }, args: { title: string }) => {
    const id = Math.random().toString(16).replace(/\./g, "");
    $list((list) => {
      list[id] = {
        id,
        title: args.title,
      };
    });
  })
  .mutation("rename", ({ $list }, args: { id: string; title: string }) => {
    $list((list) => {
      list[args.id].title = args.title;
    });
  })
  .mutation("remove", ({ $list }, args: { id: string }) => {
    $list((list) => {
      delete list[args.id];
    });
  })
  .mutation("clear", ({ $list }) => {
    $list({});
  });

const { useAdd, useRemove, useRename, useList, useClear } = hooks(
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
      <blockquote>
        This app demonstrates using `state`. A state is where to store sync
        data, when the state is changed, its consumers will be notified
        immediately as well.
      </blockquote>
      <form onSubmit={handleSubmit}>
        <input ref={titleRef} type="text" placeholder="What need to be done?" />
      </form>
      <p></p>
      <p>
        <strong>List:</strong>
      </p>
      <button onClick={() => clear.mutate()}>Clear</button>
      <p></p>
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
      <p>
        <strong>Data:</strong>
      </p>
      <pre>{JSON.stringify(list, null, 2)}</pre>
    </>
  );
};

export { App };
