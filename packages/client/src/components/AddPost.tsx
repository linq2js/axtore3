import { FormEvent, useState } from "react";

import { AddMutation } from "logic/mutations/AddMutation";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { Group } from "./Group";
import { generateId } from "../util";
import { use } from "axtore/react";

export type Props = {};

const AddPost = (props: Props) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { loading, mutate } = use(AddMutation);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await mutate({
      post: {
        id: generateId(),
        body,
        title,
      },
    });
    setTitle("");
    setBody("");
  };

  return (
    <Form onSubmit={handleSubmit} className="mb-3">
      <h2>Add Post</h2>
      <Group
        name="Title"
        value={title}
        onChange={setTitle}
        disabled={loading}
      />
      <Group name="Body" value={body} onChange={setBody} disabled={loading} />
      <Button
        variant="primary"
        type="submit"
        onSubmit={handleSubmit}
        disabled={loading}
      >
        Submit
      </Button>
    </Form>
  );
};

export { AddPost };
