import fetch from "cross-fetch";

export type Item = { id: number };

const createCollection = <T extends Item>(
  type: string,
  endpoint: string,
  mandatoryFields?: string[],
  normalizer?: (item: T) => void
) => {
  let items: T[];
  const all = async () => {
    if (!items) {
      items = await fetch(endpoint).then((x) => x.json());
      if (normalizer) {
        items.forEach(normalizer);
      }
    }
    return items;
  };

  const remove = async (id: number) => {
    const items = await all();
    const index = items.findIndex((x) => x.id === id);
    if (index === -1) return undefined;
    const [removed] = items.splice(index, 1);
    return removed;
  };

  const add = async (item: T) => {
    const items = await all();
    if (items.find((x) => x.id === item.id)) {
      throw new Error(`${type} with id=${item.id} already exists`);
    }
    if (normalizer) {
      normalizer(item);
    }
    items.push(item);
  };

  const update = async (id: number, changes: Partial<T>) => {
    const items = await all();
    const copyOfData = { ...changes };

    if (mandatoryFields?.length) {
      mandatoryFields.forEach((key) => {
        delete copyOfData[key];
      });
    }
    const item = items.find((x) => x.id === id);

    if (!item) {
      throw new Error(`${type} with id=${id} not found`);
    }

    Object.assign(item, copyOfData);
  };

  const select = async <R>(selector: (items: T[]) => R) => {
    const items = await all();
    return selector(items);
  };

  return { all, add, remove, update, use: select };
};

export { createCollection };
