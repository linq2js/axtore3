import {
  Client,
  CreateDynamicMutationOptions,
  CreateMutationOptions,
  CreateStaticMutationOptions,
  EMPTY_RESOLVERS,
  Mutation,
  MutationContext,
  MutationHandler,
  MutationResolver,
  NoInfer,
  OperationEvents,
  TypeDef,
} from "./types";
import { DocumentNode, OperationTypeNode } from "graphql";
import {
  addResolvers,
  createDynamicDocument,
  unwrapVariables,
  wrapDynamicResolver,
  wrapVariables,
} from "./resolver";
import { createProp, documentType, is, selectDefinition } from "./util";

import { MutationOptions } from "@apollo/client";
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
    onError,
    onCompleted,
  } = options;
  const connectedProp = Symbol(generateName("mutation"));

  const mergeOptions = (
    client: Client,
    options?: Omit<MutationOptions<any, any>, "mutation"> &
      OperationEvents<void, TData>
  ) => {
    const variables = wrapVariables(dynamic, {
      ...defaultVariables,
      ...unwrapVariables(options?.variables),
    });

    return {
      mutation: document,
      fetchPolicy,
      ...options,
      variables,
      context: { ...defaultContext, ...options?.context },
      onCompleted:
        options?.onCompleted || onCompleted
          ? (data: any) => {
              onCompleted?.(data, variables);
              options?.onCompleted?.(data);
            }
          : undefined,
      onError:
        options?.onError || onError
          ? (error: any) => {
              onError?.(error, variables);
              options?.onError?.(error);
            }
          : undefined,
    };
  };

  const mutation: Mutation = {
    type: "mutation",
    document,
    dynamic: !!dynamic,
    wrap(prop, { map, prepare } = {}): any {
      return createMutation(
        prop,
        async (args: any, context: MutationContext) => {
          if (prepare) {
            await prepare(args, context);
          }

          const result: any = await (context.call as Function)(mutation, {
            variables: args,
          });

          return map?.(result, { ...context, args });
        }
      );
    },
    use(client) {
      return createProp(
        client,
        connectedProp,
        (): MutationHandler<any, any> => {
          addResolvers(client, mutation, resolvers, typeDefs);

          return {
            mergeOptions(options) {
              return mergeOptions(client, options);
            },
            async call(...args: any[]) {
              const mutationOptions = mergeOptions(client, args[0]);
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
