import { Suspense } from "react";
import { model, gql } from "axtore";
import { createHooks } from "axtore/react";
import { SearchTerm } from "../types";

const appModel = model()
  // define `term` state
  .state("term", { searchIn: "title", text: "" } as SearchTerm)
  // define `changeTerm` dynamic mutation
  .mutation("changeTerm", (args: Partial<SearchTerm>, { $term }) => {
    // set `term` state value
    $term((term) => {
      Object.assign(term, args);
    });
  })
  // define static query
  .query(
    "fetchPosts",
    // using `gql` function to convert normal graphql node to typed graphql node
    gql<{ term: SearchTerm }, { posts: { id: number; title: string }[] }>`
      query ($term: Any!) {
        posts(term: $term) @client
      }
    `
  )
  .query(
    "postList",
    async (_: void, { $term, $fetchPosts }) => {
      console.log("start searching");

      // get `term` state value and listen state changing event
      const term = $term();

      // we might call other queries to prepare the input for `fetchPosts` query

      // call other query to fetch data
      const { posts } = await $fetchPosts({ term });
      return posts;
    },
    { debounce: 1000, hardRefetch: true }
  );

const { usePostList, useChangeTerm, useTerm } = createHooks(appModel.meta);

const FilterByText = () => {
  const term = useTerm();
  const changeTerm = useChangeTerm();

  return (
    <p>
      <select
        value={term.searchIn}
        onChange={(e) =>
          changeTerm.mutate({ searchIn: e.currentTarget.value as any })
        }
      >
        <option value="body">Body</option>
        <option value="title">Title</option>
      </select>
      <input
        type="text"
        value={term.text}
        onChange={(e) => changeTerm.mutate({ text: e.currentTarget.value })}
        placeholder="Enter search term"
      />
    </p>
  );
};

const FilterByUser = () => {
  const term = useTerm();
  const changeTerm = useChangeTerm();

  return (
    <p>
      <select
        value={term.userId || 0}
        onChange={(e) =>
          changeTerm.mutate({ userId: parseInt(e.currentTarget.value, 10) })
        }
      >
        <option value={0}>Any User</option>
        {new Array(10).fill(0).map((_, index) => (
          <option key={index} value={index + 1}>
            User {index + 1}
          </option>
        ))}
      </select>
    </p>
  );
};

const PostList = () => {
  const postList = usePostList().wait();
  return <pre>{JSON.stringify(postList, null, 2)}</pre>;
};

const App = () => {
  return (
    <>
      <FilterByText />
      <FilterByUser />
      <Suspense fallback="Searching...">
        <PostList />
      </Suspense>
    </>
  );
};

export { App };
