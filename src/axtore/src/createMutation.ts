import {
  CreateDynamicMutationOptions,
  CreateMutationOptions,
  CreateStaticMutationOptions,
  EMPTY_RESOLVERS,
  Mutation,
  MutationHandler,
  MutationResolver,
  NoInfer,
  TypeDef,
} from "./types";
import { DocumentNode, OperationTypeNode } from "graphql";
import {
  addResolvers,
  createDynamicDocument,
  unwrapVariables,
  wrapDynamicResolver,
  wrapVariables,
} from "./resolverUtils";
import { createProp, documentType, is, selectDefinition } from "./util";

import { generateName } from "./generateName";

export type CreateMutation = {
  /**
   * create static mutation
   */
  <TVariables = any, TData = any>(
    document: DocumentNode,
    options?: CreateStaticMutationOptions<TData>
  ): Mutation<TVariables, TData>;

  /**
   * create dynamic mutation
   */
  <TField extends string, TVariables = any, TData = any>(
    field: TField,
    resolver: MutationResolver<TVariables, TData>,
    options?: CreateDynamicMutationOptions<TData>
  ): Mutation<TVariables, { [key in TField]: TData }>;

  <TVariables = any, TData = any>(
    mutations: {
      [key in keyof TData]:
        | Mutation<TVariables, TData[key]>
        | MutationResolver<TVariables, TData[key]>;
    },
    options?: Omit<CreateDynamicMutationOptions<TData>, "type">
  ): Mutation<TVariables, { all: TData }>;
};

const createMutationInternal = <TVariables = any, TData = any>(
  document: DocumentNode,
  typeDefs: TypeDef[],
  resolvers: Record<string, any> = EMPTY_RESOLVERS,
  options: NoInfer<
    CreateMutationOptions<TVariables> & { dynamic?: boolean }
  > = {}
): Mutation<TVariables, TData> => {
  const {
    variables: defaultVariables,
    context: defaultContext,
    fetchPolicy,
    dynamic,
  } = options;
  const connectedProp = Symbol(generateName("mutation"));

  const mergeOptions: Mutation["mergeOptions"] = (options) => {
    const variables = {
      ...defaultVariables,
      ...unwrapVariables(options?.variables),
    };
    return {
      mutation: document,
      fetchPolicy,
      variables: wrapVariables(dynamic, variables),
      context: { ...defaultContext, ...options?.context },
    };
  };

  const mutation: Mutation = {
    type: "mutation",
    document,
    dynamic: !!dynamic,
    mergeOptions,
    use(client) {
      return createProp(
        client,
        connectedProp,
        (): MutationHandler<any, any> => {
          addResolvers(client, mutation, resolvers, typeDefs);

          return {
            async call(...args: any[]) {
              const mutationOptions = mergeOptions({
                variables: args[0]?.variables,
              });
              const result = await client.mutate(mutationOptions);
              if (!result) throw new Error("Invalid mutation data");
              if (result.errors?.length) throw result.errors[0];
              return result.data;
            },
          };
        }
      );
    },
  };

  return mutation;
};

const createMutation: CreateMutation = (...args: any[]) => {
  // mutation(field, resolver, options?)
  if (typeof args[0] === "string") {
    const [field, resolver, options] = args as [
      string,
      Function,
      CreateDynamicMutationOptions | undefined
    ];

    const { fieldName, document } = createDynamicDocument("mutation", field);

    return createMutationInternal(
      document,
      [],
      {
        [fieldName]: options?.type
          ? [wrapDynamicResolver(resolver), options?.type]
          : wrapDynamicResolver(resolver),
      },
      { ...options, dynamic: true }
    );
  }

  if (is(args[0], documentType)) {
    const [document, options] = args as [
      DocumentNode,
      CreateStaticMutationOptions | undefined
    ];

    return createMutationInternal(
      options?.operation
        ? selectDefinition(
            document,
            OperationTypeNode.MUTATION,
            options.operation
          )
        : document,
      options?.types ?? [],
      options?.resolve,
      options
    );
  }

  throw new Error(`No overload for these arguments ${args} supported`);
};

export { createMutation };
