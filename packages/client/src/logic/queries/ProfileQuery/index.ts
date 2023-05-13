import {
  ProfileDocument,
  ProfileQueryResult,
  ProfileQueryVariables,
  User,
} from "static/graphql/types";

import { TokenAtom } from "logic/atoms/TokenAtom";
import { query } from "axtore";

const GUEST_USER: User = {
  __typename: "User",
  id: 0,
  name: "anonymous",
  email: "anonymous@tempuri.org",
};

const ProfileServerQuery = query<ProfileQueryVariables, ProfileQueryResult>(
  ProfileDocument
);

const ProfileQuery = query("profile", async (args: void, { get }) => {
  const token = get(TokenAtom);

  if (!token) return GUEST_USER;

  const result = await get(ProfileServerQuery, {
    fetchPolicy: "network-only",
  });

  return result.profile;
});

export { ProfileQuery };
