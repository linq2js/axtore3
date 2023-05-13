import { AddComment } from "./AddComment";
import Button from "react-bootstrap/Button";
import { Post } from "static/graphql/types";
import { useState } from "react";

export type Props = {
  post: Post;
};

const PostItem = (props: Props) => {
  const [showComments, setShowComments] = useState(false);

  return (
    <div className="mb-3">
      <h4>{props.post.title}</h4>
      <div>{props.post.body}</div>
      <div>
        Posted by: {props.post.userId} on{" "}
        {new Date(props.post.createdOn).toISOString()}{" "}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowComments(!showComments)}
        >
          {showComments ? "Hide comments" : "Show Comments"}
        </Button>
      </div>
      {showComments && <AddComment postId={props.post.id} />}
    </div>
  );
};

export { PostItem };
