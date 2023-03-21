import { create, delay } from "axtore";

import { gql } from "@apollo/client";

export type Todo = { id: number; completed: boolean; title: string };

const STORE_DOC = gql`
  fragment TodoPropsFragment on Todo {
    id
    title
    completed
  }
  query All {
    all {
      ...TodoPropsFragment
    }
  }

  mutation RemoveServer($id: Int!) {
    remove(id: $id)
  }

  mutation Remove($id: Int!) {
    remove: removeWithOptimistic(id: $id) @client {
      ...TodoPropsFragment
    }
  }

  mutation Toggle($id: Int!) {
    toggle(id: $id) {
      ...TodoPropsFragment
    }
  }

  mutation Add($input: AddTodoInput!) {
    add(input: $input) {
      ...TodoProps
    }
  }

  mutation Update($id: Int!, $input: UpdateTodoInput!) {
    add(id: $id, input: $input) {
      ...TodoPropsFragment
    }
  }

  mutation Login($userId: Int!) {
    login(userId: $userId) @client
  }
`;

export type FilterType = "all" | "completed" | "active";

type AllQueryVariables = void;
type AllQueryData = { all: Todo[] };

type FilteredQueryVariables = void;
type FilteredQueryData = {
  filtered: Todo[];
};

type AddMutationVariables = { input: Todo };
type AddMutationData = { add: Todo };

type UpdateMutationVariables = {
  id: number;
  input: Partial<Omit<Todo, "id" | "userId">>;
};
type UpdateMutationData = { update: Todo };

type RemoveMutationVariables = { id: number };
type RemoveMutationData = { remove: Todo };
type RemoveWithOptimisticMutationData = { removeWithOptimistic: Todo };

type ToggleMutationVariables = { id: number };
type ToggleMutationData = { toggle: Todo };

type LoginMutationVariables = { userId: number };
type LoginMutationData = { login: void };

type LogoutMutationVariables = void;
type LogoutMutationData = { logout: void };

type ChangeFilterMutationVariables = { filter: FilterType };
type ChangeFilterMutationData = { changeFilter: void };

const store = create(STORE_DOC)
  /**
   * ATOMS
   */
  .use("Token", (d) => d.atom(0))
  .use("Filter", (d) => d.atom("all" as FilterType))
  /**
   * QUERIES
   */
  .use("All", (d, { Token }) =>
    d.query<AllQueryVariables, AllQueryData>({
      // when Token changed, do evicting on `all` field of the query
      evict: { when: d.changed(Token) },
      // do re-fetching after 5s
      // refetch: { when: d.after(3000) },
    })
  )
  // client query for filtering All todos which is fetched from server
  .use("Filtered", (d, { All, Filter }) =>
    d.query<FilteredQueryVariables, FilteredQueryData>({
      client: true,
      resolve: {
        async filtered(_, { get }) {
          const filter = get(Filter);
          const { all } = await get(All);

          if (filter === "completed") {
            return all.filter((x) => x.completed);
          }

          if (filter === "active") {
            return all.filter((x) => !x.completed);
          }
          return all;
        },
      },
    })
  )
  /**
   * MUTATIONS
   */
  .use("Add", (d) => d.mutation<AddMutationVariables, AddMutationData>())
  .use("Update", (d) =>
    d.mutation<UpdateMutationVariables, UpdateMutationData>()
  )
  .use("RemoveServer", (d) =>
    d.mutation<RemoveMutationVariables, RemoveMutationData>()
  )
  .use("Remove", (d, { RemoveServer }) =>
    d.mutation<RemoveMutationVariables, RemoveWithOptimisticMutationData>({
      resolve: {
        async removeWithOptimistic(
          args: RemoveMutationVariables,
          { call, evict }
        ) {
          // do optimistic update before server call
          evict("Todo", args.id);
          // call server mutation
          const result = await call(RemoveServer, {
            variables: { id: args.id },
          });
          alert("Todo deleted");
          return result.remove;
        },
      },
    })
  )
  .use("Toggle", (d) =>
    d.mutation<ToggleMutationVariables, ToggleMutationData>()
  )
  .use("Login", (d, { Token }) =>
    d.mutation<LoginMutationVariables, LoginMutationData>({
      resolve: {
        async login(args: LoginMutationVariables, { set }) {
          // fake delaying effect
          await delay(1000);
          set(Token, { data: args.userId });
        },
      },
    })
  )
  .use("Logout", (d, { Token }) =>
    d.mutation<LogoutMutationVariables, LogoutMutationData>({
      client: true,
      resolve: {
        logout(_, { set }) {
          set(Token, { data: 0 });
        },
      },
    })
  )
  .use("ChangeFilter", (d, { Filter }) =>
    d.mutation<ChangeFilterMutationVariables, ChangeFilterMutationData>({
      client: true,
      resolve: {
        changeFilter(args, { set }) {
          set(Filter, { data: args.input.filter });
          set({ aaa: 1 }, { aaa: () => 1 });
        },
      },
    })
  );

export { store };
