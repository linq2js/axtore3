import { gql, model } from "axtore";
import { hooks } from "axtore/react";
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

const { useTime, useMe } = hooks(appModel.meta);

const OneTimeUpdate = () => {
  const me = useMe();
  return (
    <>
      <p>
        <strong>One time update</strong>
      </p>
      <pre>{JSON.stringify(me.data, null, 2)}</pre>
    </>
  );
};

const ContinuousUpdate = () => {
  const time = useTime();

  return (
    <>
      <p>
        <strong>Continuous update</strong>
      </p>
      <p>{time.data?.time}</p>
    </>
  );
};

const App = () => {
  return (
    <>
      <blockquote>
        This app demonstrates lazy data updating. We can control lazy updating
        for every single type field or query result
      </blockquote>
      <ContinuousUpdate />
      <OneTimeUpdate />
    </>
  );
};

export { App };
