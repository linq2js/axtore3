import { use, useStable } from "axtore/react";

import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { Group } from "./Group";
import { LogoutMutation } from "logic/mutations/LogoutMutation";
import { ProfileQuery } from "logic/queries/ProfileQuery";

export type Props = {};

const Profile = (props: Props) => {
  const profileQuery = use(ProfileQuery).wait();
  const logoutMutation = use(LogoutMutation);
  const callbacks = useStable({
    handleLogout() {
      logoutMutation.mutate();
    },
  });

  return (
    <Form className="mb-3">
      <h3>Profile</h3>
      <Group name="Id" value={profileQuery.profile.id} readOnly />
      <Group name="Name" value={profileQuery.profile.name} readOnly />
      <Group name="Email" value={profileQuery.profile.email} readOnly />
      {profileQuery.profile.id > 0 && (
        <Button variant="primary" onClick={callbacks.handleLogout}>
          Logout
        </Button>
      )}
    </Form>
  );
};

export { Profile };
