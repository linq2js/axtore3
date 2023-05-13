import { PostList } from "./PostList";
import { UserPostListQuery } from "logic/queries/UserPostListQuery";
import { use } from "axtore/react";

export type Props = {};

const UserPostList = (props: Props) => {
  const { posts: items } = use(UserPostListQuery).wait();
  return <PostList name="My Posts" items={items} />;
};

export { UserPostList };
