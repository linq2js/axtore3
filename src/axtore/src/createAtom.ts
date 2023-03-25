import {
  Atom,
  AtomContext,
  AtomHandler,
  CreateAtomOptions,
  NoInfer,
  gql,
} from "./types";
import { createProp, isFunction } from "./util";
import { createTypePatcher, getUpdatedData } from "./resolverUtils";

import { callbackGroup } from "./callbackGroup";
import { generateName } from "./generateName";
import { makeVar } from "@apollo/client";

const createAtom = <TData>(
  data: TData | ((context: AtomContext) => TData),
  options: NoInfer<CreateAtomOptions<TData>> = {}
): Atom<TData> => {
  const { key, equal = Object.is, type } = options;
  const hasKey = !!key;
  const propName = generateName("atom", key);
  const connectedProp = Symbol(propName);
  const document = gql`query ${propName} { ${propName} }`;
  const typePatcher = type ? createTypePatcher(type) : undefined;

  return {
    type: "atom",
    document,
    use(client) {
      return createProp(client, connectedProp, (): AtomHandler<any> => {
        const dependencyChangeListenerRemovers = new Map<any, VoidFunction>();
        const onChange = callbackGroup();
        const invalidate = () => {
          setData(getData());
        };
        const getData = () => {
          dependencyChangeListenerRemovers.forEach((remover) => remover());
          dependencyChangeListenerRemovers.clear();

          if (isFunction(data)) {
            const context: AtomContext = {
              get(atom) {
                const connectedAtom = atom.use(client);
                const result = connectedAtom.get();
                if (!dependencyChangeListenerRemovers.has(atom)) {
                  dependencyChangeListenerRemovers.set(
                    atom,
                    connectedAtom.subscribe({ onChange: invalidate })
                  );
                }

                return result;
              },
            };
            return (data as (context: AtomContext) => any)(context);
          }
          return data;
        };
        let initData = hasKey ? client.readQuery({ query: document }) : null;
        const reactiveVar = makeVar(initData ? initData[propName] : getData());
        const changeListener = (data: any) => {
          // continue listening because this change notification happens once
          reactiveVar.onNextChange(changeListener);
          onChange.invoke(data);
        };
        reactiveVar.onNextChange(changeListener);
        const setData = (data: any) => {
          if (equal(data, reactiveVar())) return;

          if (typePatcher) {
            data = typePatcher(data);
          }

          reactiveVar(data);

          if (hasKey) {
            client.writeQuery({
              query: document,
              data: { [propName]: data },
            });
          }
        };

        return {
          reactiveVar,
          get() {
            return reactiveVar();
          },
          set(options) {
            const data = getUpdatedData(options.data, reactiveVar);
            setData(data);
          },
          subscribe(options) {
            const remove = onChange(options.onChange);
            return remove;
          },
        };
      });
    },
  };
};

export { createAtom };
