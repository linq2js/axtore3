import { model } from "axtore";
import { createUseModel } from "axtore/react";

const counterModel = model()
  .state("count", 1)
  .mutation("increment", ({ $count }) => {
    $count((prev) => prev + 1);
  });

const useCounterModel = createUseModel(counterModel.meta);

const Counter = (props: { name: string }) => {
  const { useCount, useIncrement } = useCounterModel();
  const count = useCount();
  const increment = useIncrement();

  return (
    <>
      <h1>
        {props.name}: {count}
      </h1>
      <button onClick={() => increment()}>Increment</button>
    </>
  );
};

const App = () => {
  return (
    <>
      <Counter name="Counter 1" />
      <Counter name="Counter 2" />
    </>
  );
};

export { App };
