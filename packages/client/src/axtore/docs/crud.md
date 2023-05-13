# How to do CRUD with Axtore

## Creating new entity

Let say we have some mutations look like these:

```tsx
const TodoList = query<TodoListVariables, TodoListData>(gql`
  query TodoList {
    todoList {
      id
      title
      completed
    }
  }
`);

const CreateTodoSever = mutation<CreateTodoVariables, CreateTodoData>(gql`
  mutation CreateTodo($todo: TodoInput) {
    createTodo(todo: $todo)
  }
`);

const CreateTodo = mutation("update", (args: CreateTodoVariables, { call }) => {
  await call(CreateTodoSever, { variables: { todo: args.todo } });
});
```

### Refetching relevant queries

We can do refetching relevant queries after createTodo mutation called successfully

```tsx
const CreateTodo = mutation(
  "update",
  (args: CreateTodoVariables, { call, refetch }) => {
    await call(CreateTodoSever, { variables: { todo: args.todo } });
    refetch(TodoList);
  }
);
```

In this way, the UI will be blocked until the mutation called successfully

### Optimistic updating cache

The idea for doing optimistic updating is, create a new query that wraps TodoList query, we can name it TodoList and rename original TodoList query to TodoListServer. We will use an atom to store new todo data (name it NewTodo) and TodoList query will consumes that atom. That mean whenever NewTodo atom changed, the TodoList query will be re-fetched as well. In the TodoList query body, we will check whether the new todo is existing in the list or not. If the new todo data does not exist in the list, just append it to the list and do nothing if it is already in the list. We can use this solution for all queries which need to be updated when new todo added.

```tsx
const NewTodo = atom<Todo | undefined>(undefined);

const TodoListServer = query<TodoListVariables, TodoListData>(gql`
  query TodoList {
    todoList {
      id
      title
      completed
    }
  }
`);

const TodoList = query("todoList", async (args: void, { get }) => {
  // we don't need to read TodoListServer server from cache. Apollo will cache TodoList data automatically so one query call executed only
  let todoList = await get(TodoListServer, { fetchPolicy: "network-only" });
  // TodoList query consumes NewTodo atom, when the atom data is changed the query re-fetches as well
  const newTodo = get(NewTodo);
  // append new todo if it is not in the list
  if (newTodo && todoList.find((x) => x.id === newTodo.id)) {
    todoList = [...todoList, newTodo];
  }
  return newTodo;
});

const CreateTodo = mutation(
  "update",
  (args: CreateTodoVariables, { call, refetch, set }) => {
    // do optimistic update
    set(NewTodo, { data: args.todo });
    await call(CreateTodoSever, { variables: { todo: args.todo } });
  }
);
```

## Updating entity

## Deleting entity
