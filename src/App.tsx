import "./App.css";

import {
  Add,
  ChangeFilter,
  Filter,
  Filtered,
  Login,
  Logout,
  Remove,
  Toggle,
  Token,
  Update,
} from "./logics/full";
import {
  ApolloClient,
  ApolloProvider,
  HttpLink,
  InMemoryCache,
  from,
} from "@apollo/client";
import { FormEvent, Suspense, useRef } from "react";

import { Todo } from "./logics/types";
import { setContext } from "@apollo/client/link/context";
import { use } from "axtore/react";

const TodoItem = (props: { todo: Todo }) => {
  const toggle = use(Toggle);
  const remove = use(Remove);
  const update = use(Update);
  const loading = toggle.loading || remove.loading || update.loading;
  const handleToggle = () => {
    toggle.mutate({ id: props.todo.id });
  };
  const handleEdit = () => {
    const newTitle = prompt("Update todo title", props.todo.title);
    if (!newTitle || newTitle === props.todo.title) return;
    update.mutate({ id: props.todo.id, input: { title: newTitle } });
  };
  const handleRemove = () => {
    const confirmMessage = `Are you sure you want to remove the todo ${props.todo.id} - ${props.todo.title}`;
    if (!confirm(confirmMessage)) return;
    remove.mutate({ id: props.todo.id });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        columnGap: 10,
        opacity: loading ? 0.5 : 1,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={props.todo.completed}
        disabled={loading}
        onChange={handleToggle}
        style={{ cursor: "pointer" }}
      />
      <a onClick={handleEdit}>[edit]</a>
      <div
        style={{
          textDecoration: props.todo.completed ? "line-through" : "none",
        }}
        onClick={handleRemove}
      >
        {props.todo.id} - {props.todo.title}
      </div>
    </div>
  );
};

const ListFilter = () => {
  const changeFilter = use(ChangeFilter);
  const filter = use(Filter);

  return (
    <div
      style={{
        margin: "10px 0",
        columnGap: 10,
        display: "flex",
        flexDirection: "row",
      }}
    >
      <label onClick={() => changeFilter.mutate({ filter: "all" })}>
        <input readOnly type="radio" checked={filter === "all"} />
        All
      </label>
      <label onClick={() => changeFilter.mutate({ filter: "active" })}>
        <input readOnly type="radio" checked={filter === "active"} />
        Active
      </label>
      <label onClick={() => changeFilter.mutate({ filter: "completed" })}>
        <input readOnly type="radio" checked={filter === "completed"} />
        Completed
      </label>
    </div>
  );
};

const SignOutButton = () => {
  const { mutate: signOut, loading } = use(Logout);

  return (
    <button disabled={loading} onClick={() => signOut()}>
      Logout
    </button>
  );
};

const TodoList = () => {
  const { filtered: todos } = use(Filtered).wait();
  const userId = use(Token);
  const add = use(Add);
  const handleAdd = () => {
    const title = prompt("Enter todo tile");
    if (!title) return;
    const newTodo = {
      id: Date.now() % 0xffffffff,
      title,
      userId,
      completed: false,
    };
    add.mutate({ input: newTodo });
  };

  return (
    <>
      <button disabled={add.loading} onClick={handleAdd}>
        {add.loading ? "Adding..." : "Add"}
      </button>
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </>
  );
};

const SignInForm = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate: signIn, loading } = use(Login);

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
  const userId = use(Token);

  if (!userId) {
    return <SignInForm />;
  }
  return (
    <>
      <h1>User: {userId}</h1>
      <SignOutButton />
      <ListFilter />
      <TodoList />
    </>
  );
};

const AuthorizationLink = setContext((_, { headers }) => {
  return {
    headers: {
      // keep previous headers
      ...headers,
      // override authorization header
      authorization: Token.use(client).get(),
    },
  };
});

const client = new ApolloClient({
  link: from([
    AuthorizationLink,
    new HttpLink({ uri: "http://localhost:4000/" }),
  ]),
  cache: new InMemoryCache(),
});

export default () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ApolloProvider client={client}>
        <App />
      </ApolloProvider>
    </Suspense>
  );
};
