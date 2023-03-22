import {
  BuilderContext,
  Client,
  Create,
  CreateMutationOptions,
  CreateQueryOptions,
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
import {
  documentType,
  is,
  isAtom,
  isFunction,
  isQuery,
  isStore,
  typeDefType,
} from "./util";

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

      if (isFunction(args[0])) {
        const builder = args[0];
        const context = createBuilderContext(
          typeDefs,
          (expectedOperation, operationName) => {
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
                definitions: [operationDefinition, ...usedFragmentDefinitions],
              };
            }
            return documentNode;
          }
        );
        const newDefs = builder(context, defs);

        Object.keys(newDefs).forEach((key) => {
          if (typeof newDefs[key] === "function") {
            newDefs[key] = newDefs[key](key);
          }
        });

        return createStoreInternal(document, typeDefs, {
          ...defs,
          ...newDefs,
        });
      }

      // use(...types)
      if (is<TypeDef>(args[0], typeDefType)) {
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

const createDocumentForResolver = (
  type: "query" | "mutation",
  field: string,
  key?: string
) => {
  const operationName = generateName(type, key);
  const resolverName = `${operationName}${field}`;
  return {
    resolverName,
    document: gql`
    ${type}
    ${operationName} ($input: OPERATION_INPUT) {
      ${field}: ${resolverName}(input: $input) @client
    }
  `,
  };
};

const wrapDynamicResolver = (resolver: Function) => (args: any, context: any) =>
  resolver(args?.input, context);

const createDynamicQuery = (
  typeDefs: TypeDef[],
  field: string,
  resolver: Function,
  typeDef?: TypeDef,
  options?: CreateQueryOptions
) => {
  const { document, resolverName } = createDocumentForResolver(
    "query",
    field,
    options?.key
  );

  return createQuery(
    document,
    typeDefs,
    {
      [resolverName]: typeDef
        ? [wrapDynamicResolver(resolver), typeDef]
        : wrapDynamicResolver(resolver),
    },
    { ...options, dynamic: true }
  );
};

const createDynamicMutation = (
  typeDefs: TypeDef[],
  field: string,
  resolver: Function,
  typeDef?: TypeDef,
  options?: CreateMutationOptions
) => {
  const { document, resolverName } = createDocumentForResolver(
    "mutation",
    field
  );

  return createMutation(
    document,
    typeDefs,
    {
      [resolverName]: typeDef
        ? [wrapDynamicResolver(resolver), typeDef]
        : wrapDynamicResolver(resolver),
    },
    { ...options, dynamic: true }
  );
};

const createBuilderContext = (
  typeDefs: TypeDef[],
  createDocument: (
    expectedOperation: OperationTypeNode,
    operationName: string
  ) => DocumentNode
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
    query(...args: any[]): any {
      // query()
      // query(options)
      if (!args.length || (args[0] && typeof args[0] === "object")) {
        // we return query factory and retrieve definition prop from the store then use that prop as OperationName
        return (prop: string) => {
          return createQuery(
            createDocument(OperationTypeNode.QUERY, prop),
            typeDefs,
            undefined,
            args[1]
          );
        };
      }
      // query(operationName, options?)
      // query(field, resolver, options?)
      // query(field, resolver, typeDef, options?)
      if (typeof args[0] === "string") {
        // query(field, resolver, options?)
        // query(field, resolver, typeDef, options?)
        if (typeof args[1] === "function") {
          // query(field, resolver, typeDef, options?)
          if (is(args[2], typeDefType)) {
            return createDynamicQuery(
              typeDefs,
              args[0],
              args[1],
              args[2],
              args[3]
            );
          }
          return createDynamicQuery(
            typeDefs,
            args[0],
            args[1],
            undefined,
            args[2]
          );
        }

        const [operationName, options] = args as [
          string,
          CreateQueryOptions | undefined
        ];
        return createQuery(
          createDocument(OperationTypeNode.QUERY, operationName),
          typeDefs,
          undefined,
          options
        );
      }

      if (isFunction(args[0])) {
        return (prop: string) => {
          // query(resolver, typeDef, options?)
          if (is(args[1], typeDefType)) {
            return createDynamicQuery(
              typeDefs,
              prop,
              args[0],
              args[1],
              args[2]
            );
          }
          // query(resolver, options?)
          return createDynamicQuery(
            typeDefs,
            prop,
            args[0],
            undefined,
            args[1]
          );
        };
      }

      if (is(args[0], documentType)) {
        return createQuery(args[0], typeDefs, undefined, args[1]);
      }

      throw new Error("Invalid operation");
    },
    mutation(...args: any[]): any {
      // mutation()
      // mutation(options)
      if (!args.length || (args[0] && typeof args[0] === "object")) {
        // we return mutation factory and retrieve definition prop from the store then use that prop as OperationName
        return (prop: string) => {
          return createMutation(
            createDocument(OperationTypeNode.QUERY, prop),
            typeDefs,
            undefined,
            args[1]
          );
        };
      }

      // mutation(operationName, options?)
      // mutation(field, resolver, options?)
      // mutation(field, resolver, typeDef, options?)
      if (typeof args[0] === "string") {
        // mutation(field, resolver, options?)
        // mutation(field, resolver, typeDef, options?)
        if (typeof args[1] === "function") {
          if (is(args[2], typeDefType)) {
            return createDynamicMutation(
              typeDefs,
              args[0],
              args[1],
              args[2],
              args[3]
            );
          }
          return createDynamicMutation(
            typeDefs,
            args[0],
            args[1],
            undefined,
            args[2]
          );
        }

        const [operationName, options] = args as [
          string,
          CreateMutationOptions | undefined
        ];

        return createMutation(
          createDocument(OperationTypeNode.QUERY, operationName),
          typeDefs,
          undefined,
          options
        );
      }

      if (isFunction(args[0])) {
        return (prop: string) => {
          // mutation(resolver, typeDef, options?)
          if (is(args[1], typeDefType)) {
            return createDynamicMutation(
              typeDefs,
              prop,
              args[0],
              args[1],
              args[2]
            );
          }
          // mutation(resolver, options?)
          return createDynamicMutation(
            typeDefs,
            prop,
            args[0],
            undefined,
            args[1]
          );
        };
      }

      if (is(args[0], documentType)) {
        return createQuery(args[0], typeDefs, undefined, args[1]);
      }

      throw new Error("Invalid operation");
    },
    atom: createAtom,
    lazy,
    rest: createRestResolver,
  };
};

const createStore: Create = (...args: any[]): Store<{}> => {
  // create()
  if (!args.length) {
    return createStoreInternal(EMPTY_DOCUMENT_GQL, [], {});
  }
  // create(builder)
  if (typeof args[0] === "function") {
    return createStoreInternal(EMPTY_DOCUMENT_GQL, [], {}).use(args[0]);
  }

  // create(document)
  return createStoreInternal(args[0], [], {});
};

export { createStore };
