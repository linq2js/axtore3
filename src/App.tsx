import "./App.css";

import { FormEvent, useRef } from "react";
import { Todo, store } from "./store";
import { gql, useQuery } from "@apollo/client";

import { use } from "axtore/react";

const TodoItem = (props: { todo: Todo }) => {
  const toggle = use(store.defs.Toggle);
  const remove = use(store.defs.Remove);
  const loading = toggle.loading || remove.loading;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        columnGap: 10,
        opacity: loading ? 0.5 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={props.todo.completed}
        disabled={loading}
        onChange={() => toggle.mutate({ id: props.todo.id })}
      />
      <div
        style={{
          textDecoration: props.todo.completed ? "line-through" : "none",
        }}
        onClick={() => remove.mutate({ id: props.todo.id })}
      >
        {props.todo.id} - {props.todo.title}
      </div>
    </div>
  );
};

const ListFilter = () => {
  const changeFilter = use(store.defs.ChangeFilter);
  const filter = use(store.defs.Filter);

  return (
    <div
      style={{
        margin: "10px 0",
        columnGap: 10,
        display: "flex",
        flexDirection: "row",
      }}
    >
      <label onClick={() => changeFilter.mutate({ input: { filter: "all" } })}>
        <input type="radio" checked={filter === "all"} />
        All
      </label>
      <label
        onClick={() => changeFilter.mutate({ input: { filter: "active" } })}
      >
        <input type="radio" checked={filter === "active"} />
        Active
      </label>
      <label
        onClick={() => changeFilter.mutate({ input: { filter: "completed" } })}
      >
        <input type="radio" checked={filter === "completed"} />
        Completed
      </label>
    </div>
  );
};

const SignOutButton = () => {
  const { mutate: signOut, loading } = use(store.defs.Logout);

  return (
    <button disabled={loading} onClick={() => signOut()}>
      Logout
    </button>
  );
};

const TodoList = () => {
  const { filtered: todos } = use(store.defs.Filtered).wait();

  return (
    <>
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </>
  );
};

const SignInForm = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate: signIn, loading } = use(store.defs.Login);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const userId = parseInt(inputRef.current?.value ?? "", 10) || 0;
    signIn({ userId });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Sign In</h2>
      <input
        autoFocus
        ref={inputRef}
        placeholder={loading ? "Signing In" : "Enter user id (1 - 10)"}
        type="number"
        disabled={loading}
      />
    </form>
  );
};

const App = () => {
  const userId = use(store.defs.Token);
  const q = useQuery(
    gql`
      query Test {
        test @client
      }
    `,
    { variables: { a: 1, b: 2 } }
  );
  console.log("test", q.data);

  if (!userId) {
    return <SignInForm />;
  }
  return (
    <>
      <SignOutButton />
      <ListFilter />
      <TodoList />
    </>
  );
};

export default App;
