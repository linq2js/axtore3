import { Post } from "static/graphql/types";
import { PostItem } from "./PostItem";

export type Props = {
  name: string;
  items: Post[];
};

const PostList = (props: Props) => {
  return (
    <>
      <h3>{props.name}</h3>
      {props.items.map((post) => (
        <PostItem key={post.id} post={post} />
      ))}
    </>
  );
};

export { PostList };
