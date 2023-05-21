import { model } from "axtore";
import { hooks } from "axtore/react";
import { Suspense, useState } from "react";

const appModel = model().query(
  "data",
  async ({ delay }, args: { id: number }) => {
    await delay(1000);
    return `${args.id}:${Math.random()}`;
  },
  { stateTime: 2000 }
);

const { useData } = hooks(appModel.meta);

const DataViewer = (props: { id: number }) => {
  const { data } = useData({ variables: props }).wait();
  return <div>Data {data}</div>;
};

const DataBlock = (props: { id: number }) => {
  const [show, setShow] = useState(false);

  return (
    <div>
      <p>
        <strong>Data block {props.id}</strong>
      </p>
      <button onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
      <Suspense fallback={<div>Loading data {props.id}</div>}>
        {show && <DataViewer id={props.id} />}
      </Suspense>
      <p></p>
    </div>
  );
};

const App = () => {
  return (
    <>
      <blockquote>
        This app demonstrates data staling effect. We can specify when data is
        stale by using `staleTime`, the query data will be removed from the
        cache after `staleTime`
      </blockquote>
      <DataBlock id={1} />
      <DataBlock id={2} />
      <DataBlock id={3} />
    </>
  );
};

export { App };
