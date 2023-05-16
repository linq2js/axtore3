import { Suspense } from "react";
import { model, gql, delay } from "axtore";
import { createHooks } from "axtore/react";
import { hardRefresh } from "axtore/extras/hardRefetch";
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
    gql<SearchTerm, { posts: { id: number; title: string }[] }>`
      query ($term: Any!) {
        posts(term: $term) @client
      }
    `
  )
  .query("postList", async (_: void, { $term, $fetchPosts, use }) => {
    // `postList` query depends on `term` state that means if `term` state changed, the postList query does data re-fetching as well
    // by default the query will do soft refresh (fetching new data in background, the UI still render previous data)
    // by using `hardRefresh` extras we force the query clean up its data before doing data fetching
    use(hardRefresh); // remove this line to see soft refresh effect

    // delay execution in 500ms to make loading effect
    await delay(500);

    // get `term` state value and listen state changing event
    const term = $term();

    // we might call other queries to prepare the input for `fetchPosts` query

    // call other query to fetch data
    const { posts } = await $fetchPosts(term);
    return posts;
  });

const { usePostList, useChangeTerm, useTerm } = createHooks(appModel.meta);

const FilterByText = () => {
  const term = useTerm();
  const changeTerm = useChangeTerm();

  return (
    <p>
      <input
        type="text"
        value={term.text}
        onChange={(e) => changeTerm.mutate({ text: e.target.value })}
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
