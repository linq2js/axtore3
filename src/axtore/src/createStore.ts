import {
  BuilderContext,
  Client,
  ObjectType,
  Store,
  TypeDef,
  gql,
} from "./types";
import {
  DefinitionNode,
  DocumentNode,
  FragmentDefinitionNode,
  Kind,
  OperationDefinitionNode,
  OperationTypeNode,
} from "graphql";
import { is, isAtom, isFunction, isQuery, isStore } from "./util";

import { createAtom } from "./createAtom";
import { createMutation } from "./createMutation";
import { createQuery } from "./createQuery";
import { createRestResolver } from "./rest/createRestResolver";
import { generateName } from "./generateName";
import { lazy } from "./resolverUtils";

const EMPTY_DOCUMENT_GQL = gql`
  query ___EMPTY_DOCUMENT_QUERY__ {
    noop
  }
`;

const createDocumentFromResolvers = (
  type: "query" | "mutation",
  resolverNames: string[],
  key?: string
) => {
  const graphqlString = `${type} ${generateName(
    type,
    key
  )} ($input: OPERATION_INPUT) { ${resolverNames
    .map((x) => `${x}(input: $input) @client`)
    .join(" ")} }`;

  console.log(graphqlString);

  return gql([graphqlString]);
};

const createStoreInternal = <TDefs>(
  document: DocumentNode,
  typeDefs: TypeDef[],
  defs: TDefs
): Store<TDefs> => {
  const operationDefinitions: OperationDefinitionNode[] = [];
  const otherDefinitions: DefinitionNode[] = [];
  const fragmentDefinitions: FragmentDefinitionNode[] = [];

  document.definitions.forEach((definitionNode) => {
    if (definitionNode.kind === Kind.OPERATION_DEFINITION) {
      operationDefinitions.push(definitionNode);
    } else if (definitionNode.kind === Kind.FRAGMENT_DEFINITION) {
      fragmentDefinitions.push(definitionNode);
    } else {
      otherDefinitions.push(definitionNode);
    }
  });

  return {
    type: "store" as const,
    document,
    defs,
    typeDefs,
    use(...args: any[]): any {
      if (
        is<DocumentNode>(
          args[0],
          (x) => x?.kind === Kind.DOCUMENT && x?.definitions
        )
      ) {
        return createStoreInternal(args[0], typeDefs, defs);
      }

      if (is<Client>(args[0], (x) => x?.addResolvers)) {
        const handler = createStoreHandler(args[0], defs);
        if (isFunction(args[1])) {
          return args[1](handler);
        }
        return handler;
      }

      if (isStore(args[0])) {
        const mergedDefs = Object.assign(
          {},
          defs,
          ...args.map((x: Store) => x.defs)
        );
        return createStoreInternal(document, typeDefs, mergedDefs);
      }

      if (typeof args[0] === "string") {
        let [operationName, def] = args;
        let definitionName = operationName;

        const nameParts = operationName.split(":");
        // contains alias
        if (nameParts.length > 1) {
          [definitionName, operationName] = nameParts;
        }

        if (isFunction(def)) {
          def = def(
            createBuilderContext(typeDefs, (expectedOperation) => {
              const operationDefinition = operationDefinitions.find(
                (x) =>
                  x.operation === expectedOperation &&
                  x.name?.value === operationName
              );

              if (!operationDefinition) {
                throw new Error(
                  `No ${expectedOperation} named '${operationName}' found`
                );
              }

              const documentNode: DocumentNode = {
                kind: Kind.DOCUMENT,
                definitions: [operationDefinition],
              };
              const documentString = JSON.stringify(documentNode);
              const usedFragmentDefinitions: FragmentDefinitionNode[] = [];
              fragmentDefinitions.forEach((fragmentDefinition) => {
                const testString = `{"kind":"FragmentSpread","name":{"kind":"Name","value":"${fragmentDefinition.name.value}"}`;
                if (documentString.includes(testString)) {
                  usedFragmentDefinitions.push(fragmentDefinition);
                }
              });

              if (usedFragmentDefinitions.length) {
                return {
                  kind: Kind.DOCUMENT,
                  definitions: [
                    operationDefinition,
                    ...usedFragmentDefinitions,
                  ],
                };
              }
              return documentNode;
            }),
            defs
          );
        }
        return createStoreInternal(document, typeDefs, {
          ...defs,
          [definitionName]: def,
        });
      }

      // use(...types)
      if (is<TypeDef>(args[0], (x) => typeof x?.name === "string")) {
        return createStoreInternal(document, [...typeDefs, ...args], defs);
      }

      // use(defs)
      if (args[0] && typeof args[0] === "object") {
        return createStoreInternal(document, typeDefs, { ...defs, ...args[0] });
      }

      throw new Error(`No overload for these arguments ${args}`);
    },
  };
};

const createStoreHandler = (client: Client, defs: any) => {
  const cachedHandlers = new Map<string, any>();
  const get = (_: any, prop: any) => {
    let handler = cachedHandlers.get(prop);
    if (!handler) {
      const def = defs[prop];
      handler = def.use(client);
      cachedHandlers.set(prop, handler);
    }
    return handler;
  };
  return new Proxy(
    {},
    {
      get,
      ownKeys(_) {
        return Object.keys(defs as any);
      },
      getOwnPropertyDescriptor(target, key) {
        return {
          value: get(target, key),
          enumerable: true,
          configurable: true,
        };
      },
    }
  );
};

const createBuilderContext = (
  typeDefs: TypeDef[],
  createDocument: (expectedOperation: OperationTypeNode) => DocumentNode
): BuilderContext => {
  return {
    changed(input: any, ...args: any[]) {
      return (client: Client, action: VoidFunction) => {
        if (isQuery(input)) {
          return input
            .use(client)
            .subscribe({ onChange: action, variables: args[0] });
        }

        if (isAtom(input)) {
          return input.use(client).subscribe({ onChange: action });
        }

        throw new Error(`Invalid input. Expected query/atom but got ${input}`);
      };
    },
    after(ms) {
      return (_, action) => {
        const timer = setInterval(action, ms);

        return () => {
          clearInterval(timer);
        };
      };
    },
    query(options = {}) {
      return createQuery(
        (options as any)["client"]
          ? createDocumentFromResolvers(
              "query",
              Object.keys(options?.resolve ?? {})
            )
          : createDocument(OperationTypeNode.QUERY),
        typeDefs,
        options
      );
    },
    mutation(options = {}) {
      return createMutation(
        (options as any)["client"]
          ? createDocumentFromResolvers(
              "mutation",
              Object.keys(options?.resolve ?? {})
            )
          : createDocument(OperationTypeNode.MUTATION),
        typeDefs,
        options
      );
    },
    atom: createAtom,
    lazy,
    rest: createRestResolver,
  };
};

const createStore = (document?: DocumentNode): Store<{}> => {
  return createStoreInternal(document || EMPTY_DOCUMENT_GQL, [], {});
};

export { createStore };
