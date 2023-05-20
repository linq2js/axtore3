import { gql, model } from "axtore";
import { print } from "graphql";
import { createHooks } from "axtore/react";
import { faker } from "@faker-js/faker";

const appModel = model()
  .type("Person", {
    name: ({ lazy, delay }) =>
      lazy("Loading...", async () => {
        await delay(2000);
        return faker.name.fullName();
      }),
  })
  .query("userProfile", () => ({ id: 1 }), { type: "Person" })
  .query(
    "me",
    gql<void, { userProfile: { id: number; name: string } }>`
      query {
        userProfile {
          id
          name
        }
      }
    `
  )
  .query("time", ({ lazy }) =>
    lazy(() => `Time: ${new Date().toISOString()}`, { interval: 1000 })
  );

const { useTime, useMe } = createHooks(appModel.meta);

const Me = () => {
  const me = useMe();
  return <pre>{JSON.stringify(me.data, null, 2)}</pre>;
};

const App = () => {
  const time = useTime();

  return (
    <>
      <div>{time.data?.time}</div>
      <Me />
    </>
  );
};

export { App };
