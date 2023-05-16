const patchTypeIfPossible = <T>(data: T, typeName?: string): T => {
  if (!typeName) return data;

  if (Array.isArray(data)) {
    return data.map((item) => patchTypeIfPossible(item, typeName)) as any;
  }

  if (data !== null && typeof data !== "undefined") {
    return { ...data, __typename: typeName };
  }

  return data;
};

export { patchTypeIfPossible };
