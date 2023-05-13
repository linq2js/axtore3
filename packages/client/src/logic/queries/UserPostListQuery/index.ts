import {
  UserPostListDocument,
  UserPostListQueryResult,
  UserPostListQueryVariables,
} from "static/graphql/types";

import { NewPostAtom } from "logic/atoms/NewPostAtom";
import { query } from "axtore";

const UserPostListQuery = query<
  UserPostListQueryVariables | undefined,
  UserPostListQueryResult
>(UserPostListDocument).wrap("posts", {
  cache: true,
  map(result, { get }) {
    const newPost = get(NewPostAtom);
    if (!newPost || result.posts.find((x) => x.id === newPost.id)) {
      return result.posts;
    }

    return [
      {
        id: newPost.id,
        body: newPost.body,
        title: newPost.title,
        userId: 0,
        createdOn: Date.now(),
      },
      ...result.posts,
    ];
  },
});

export { UserPostListQuery };
