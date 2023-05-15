import { Suspense } from "react";
import { model, gql, delay } from "axtore";
import { createHooks } from "axtore/react";
import { hardRefresh } from "axtore/extras/hardRefetch";

const appModel = model()
  // define `term` state
  .state("term", "")
  // define `changeTerm` dynamic mutation
  .mutation("changeTerm", (args: { term: string }, { $term }) =>
    // set `term` state value
    $term(args.term)
  )
  // define static query
  .query(
    "fetchPosts",
    // using `gql` function to convert normal graphql node to typed graphql node
    gql<{ term: string }, { posts: { id: number; title: string }[] }>`
      query ($term: String!) {
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

    // empty result for no term
    if (!term) {
      return [];
    }

    // we might call other queries to prepare the input for `fetchPosts` query

    // call other query to fetch data
    const { posts } = await $fetchPosts({ term });
    return posts;
  });

const { usePostList, useChangeTerm, useTerm } = createHooks(appModel.meta);

const SearchInput = () => {
  const term = useTerm();
  const changeTerm = useChangeTerm();

  return (
    <p>
      <input
        type="text"
        value={term}
        onChange={(e) => changeTerm.mutate({ term: e.target.value })}
      />
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
      <SearchInput />
      <Suspense fallback="Searching...">
        <PostList />
      </Suspense>
    </>
  );
};

export { App };
