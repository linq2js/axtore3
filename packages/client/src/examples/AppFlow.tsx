import { model } from "axtore";
import { hooks } from "axtore/react";
import { useState } from "react";

const mainModel = model()
  .use({
    shareFunction: (context) => () => {
      return true;
    },
  })
  .event("logout")
  .effect(() => {
    console.log("init app");
  })
  .effect(
    async ({ $logout }) => {
      // wait for logout event
      await $logout();
      console.log("cleanup app");
    },
    // continuous effect
    true
  );

const innerModel = mainModel
  .query("heavyQuery", () => {
    return true;
  })
  .effect(({ $heavyQuery }) => {
    // preload heavy query
    console.log("preload heavy query");
    $heavyQuery();
  })
  .effect(
    async ({ $logout }) => {
      // wait for logout event
      await $logout();
      console.log("cleanup inner module");
    },
    // continuous effect
    true
  );

const { useLogout } = hooks(mainModel.meta);

const { useHeavyQuery, useInit: useInnerModuleInit } = hooks(innerModel.meta);

const InnerPage = () => {
  useHeavyQuery();
  return <div>Inner Page</div>;
};

const App = () => {
  //   useInnerModuleInit();
  const [showInner, setShowInner] = useState(false);
  const logout = useLogout();

  return (
    <>
      <blockquote>
        This demonstrates app flow. Using effects and events to control what
        need to run while app is starting up, loading module and cleaning up
      </blockquote>
      <button onClick={() => setShowInner(!showInner)}>
        Toggle Inner Module
      </button>
      <button onClick={() => logout.fire()}>Logout</button>
      {showInner && <InnerPage />}
    </>
  );
};

export { App };
