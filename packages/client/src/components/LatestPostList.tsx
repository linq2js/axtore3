import { LatestPostListQuery } from "logic/queries/LatestPostListQuery";
import { Post } from "static/graphql/types";
import { PostList } from "./PostList";
import { use } from "axtore/react";

export type Props = {};

const LatestPostList = (props: Props) => {
  const { latestPosts: items } = use(LatestPostListQuery).wait();
  return <PostList name="Latest Posts" items={items} />;
};

export { LatestPostList };
