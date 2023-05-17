import { gql, model } from "axtore";
import { createHooks } from "axtore/react";

const appModel = model()
  .type("Person", {
    name: (person, args, { lazy, delay }) =>
      lazy("Loading...", async () => {
        await delay(2000);
        return Math.random().toString(16);
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
  .query("_private", () => 1)
  .query("time", (_: void, { lazy }) =>
    lazy(() => `Time: ${new Date().toISOString()}`, { interval: 1000 })
  )
  .effect(({ $time }) => {
    $time.on({ change: (r) => console.log("time changed", r) });
  });
const { useTime, useMe } = createHooks(appModel.meta);

const Me = () => {
  const me = useMe();
  return <pre>{JSON.stringify(me.data)}</pre>;
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
