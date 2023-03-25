import { gql } from "axtore";

export type Todo = { id: number; completed: boolean; title: string };

export type FilterType = "all" | "completed" | "active";

export type AllD = { all: Todo[] };

export type AddV = { input: Todo };
export type AddD = { add: Todo };

export type UpdateV = {
  id: number;
  input: Partial<Omit<Todo, "id" | "userId">>;
};
export type UpdateD = { update: Todo };

export type RemoveV = { id: number };
export type RemoveD = { remove: Todo };

export type ToggleV = { id: number };
export type ToggleD = { toggle: Todo };

const definitions = gql`
  fragment TodoPropsFragment on Todo {
    id
    title
    completed
  }

  query Ping {
    ping
  }

  query All {
    all {
      ...TodoPropsFragment
    }
  }

  mutation Remove($id: Int!) {
    remove(id: $id)
  }

  mutation Toggle($id: Int!) {
    toggle(id: $id) {
      ...TodoPropsFragment
    }
  }

  mutation Add($input: AddTodoInput!) {
    add(input: $input)
  }

  mutation Update($id: Int!, $input: UpdateTodoInput!) {
    update(id: $id, input: $input)
  }
`;

export { definitions };
