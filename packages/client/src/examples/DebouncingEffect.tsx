import { Suspense, useState } from "react";
import { model, gql } from "axtore";
import { hooks } from "axtore/react";
import { SearchTerm } from "../types";

const appModel = model()
  // define `term` state
  .state("term", { searchIn: "title", text: "" } as SearchTerm)
  // define `changeTerm` dynamic mutation
  .mutation("changeTerm", ({ $term }, args: Partial<SearchTerm>) => {
    // set `term` state value
    $term((term) => {
      Object.assign(term, args);
    });
  })
  // define static query
  .query(
    "fetchPosts",
    // using `gql` function (imported from axtore) to convert normal graphql node to typed graphql node
    gql<{ term: SearchTerm }, { posts: { id: number; title: string }[] }>`
      query ($term: Any!) {
        posts(term: $term) @client
      }
    `
  )
  .query(
    "postList",
    async ({ $term, $fetchPosts }) => {
      console.log("start searching");
      // get `term` state value and listen state changing event
      const term = $term();
      // call other query to fetch data
      const { posts } = await $fetchPosts({ term });
      return posts;
    },
    {
      // perform hard refetch whenever the query dependencies changed
      // with this way, the query hook can receive loading status notification
      hardRefetch: true,
      // in case of users type too fast, we delay query fetching in 300ms to avoid server hit many times
      debounce: 300,
    }
  )
  .effect(({ $postList }) => {
    console.log("init model");
    console.log("preload postList");
    $postList();
  });

const { usePostList, useChangeTerm, useTerm } = hooks(appModel.meta);

const FilterByText = () => {
  const term = useTerm();
  const changeTerm = useChangeTerm();

  return (
    <p>
      <select
        value={term.searchIn}
        onChange={(e) => changeTerm({ searchIn: e.currentTarget.value as any })}
      >
        <option value="body">Body</option>
        <option value="title">Title</option>
      </select>{" "}
      <input
        type="text"
        value={term.text}
        onChange={(e) => changeTerm({ text: e.currentTarget.value })}
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
          changeTerm({ userId: parseInt(e.currentTarget.value, 10) })
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

const SearchTermInfo = () => {
  const term = useTerm();
  return (
    <>
      <strong>Search Term</strong>
      <pre>{JSON.stringify(term)}</pre>
    </>
  );
};

const SearchForm = () => {
  return (
    <>
      <p>
        <strong>Search form</strong>
      </p>
      <FilterByText />
      <FilterByUser />
      <Suspense fallback="Searching...">
        <PostList />
      </Suspense>
    </>
  );
};

const App = () => {
  const [showSearchTerm, setShowSearchTerm] = useState(false);
  const [showSearchForm, setShowSearchForm] = useState(false);

  return (
    <>
      <blockquote>
        This app demonstrates using debouncing option of query
      </blockquote>
      <div>
        <label>
          <input
            type="checkbox"
            checked={showSearchTerm}
            onChange={(e) => setShowSearchTerm(e.currentTarget.checked)}
          />{" "}
          Show Search Term
        </label>
      </div>
      <div>
        <label>
          <input
            type="checkbox"
            checked={showSearchForm}
            onChange={(e) => setShowSearchForm(e.currentTarget.checked)}
          />{" "}
          Show Search Form
        </label>
      </div>
      {showSearchTerm && <SearchTermInfo />}
      {showSearchForm && <SearchForm />}
    </>
  );
};

export { App };
