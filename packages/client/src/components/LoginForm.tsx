import { use, useStable } from "axtore/react";

import { ChangeEvent } from "react";
import Form from "react-bootstrap/Form";
import { LoginMutation } from "logic/mutations/LoginMutation";
import { TokenAtom } from "logic/atoms/TokenAtom";

const userIds = new Array(10).fill(null).map((_, index) => index + 1);

const LoginForm = () => {
  const token = use(TokenAtom);
  const login = use(LoginMutation);
  const callbacks = useStable({
    handleChange(e: ChangeEvent<HTMLSelectElement>) {
      e.preventDefault();
      login.mutate({ userId: parseInt(e.target.value ?? "", 10) });
    },
  });

  return (
    <Form className="mb-3">
      <h3>Login</h3>
      <Form.Select
        value={token}
        onChange={callbacks.handleChange}
        disabled={login.loading}
      >
        <option disabled value={0}>
          Select user
        </option>
        {userIds.map((id) => (
          <option key={id} value={id}>
            User {id}
          </option>
        ))}
      </Form.Select>
    </Form>
  );
};

export { LoginForm };
