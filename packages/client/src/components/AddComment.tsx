import { FormEvent, useState } from "react";

import { AddMutation } from "logic/mutations/AddMutation";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { Group } from "./Group";
import { ProfileQuery } from "logic/queries/ProfileQuery";
import { generateId } from "../util";
import { use } from "axtore/react";

export type Props = {
  postId: number;
};

const AddComment = (props: Props) => {
  const { profile } = use(ProfileQuery).wait();
  const isLoggedIn = profile.id > 0;
  const [name, setName] = useState(isLoggedIn ? profile.name : "");
  const [email, setEmail] = useState(isLoggedIn ? profile.email : "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { loading, mutate } = use(AddMutation);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await mutate({
      comment: {
        id: generateId(),
        body,
        postId: props.postId,
        name,
        email,
      },
    });
    setBody("");
    setTitle("");
  };

  return (
    <Form onSubmit={handleSubmit} className="mb-3">
      <h3>Add Comment</h3>
      <Group
        name="Name"
        value={name}
        onChange={setName}
        readOnly={isLoggedIn}
        disabled={loading}
      />
      <Group
        name="Email"
        value={email}
        onChange={setEmail}
        readOnly={isLoggedIn}
        disabled={loading}
      />
      <Group
        name="Title"
        value={title}
        onChange={setTitle}
        disabled={loading}
      />
      <Group name="Body" value={body} onChange={setBody} disabled={loading} />
      <Button variant="primary" onSubmit={handleSubmit} disabled={loading}>
        Submit
      </Button>
    </Form>
  );
};

export { AddComment };
