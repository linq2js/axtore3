import { DocumentNode, TypedQueryDocumentNode } from "graphql";

import { ApolloClient } from "@apollo/client";

export type ObjectType =
  | "atom"
  | "query"
  | "mutation"
  | "lazy"
  | "loadable"
  | "model";

export type ApolloContext = { client: Client };

export type ContextType = "mutation" | "query" | "atom";

export type NoInfer<T> = [T][T extends any ? 0 : never];

export type Client<TCacheShape = any> = ApolloClient<TCacheShape>;

export type Query<TVariables = any, TData = any> = {
  type: "query";
  name: string;
  document: DocumentNode;
  resolver?: RootResolver<any, TVariables, TData>;
  model: Model;
  dataType?: string;
};

export type Mutation<TVariables = any, TData = any> = {
  type: "mutation";
  name: string;
  document: DocumentNode;
  resolver?: RootResolver<any, TVariables, TData>;
  model: Model;
  dataType?: string;
};

export type TypeResolverSet<TResolvers = any> = {
  type: "type";
  resolvers: TResolvers;
};

export type AddProp<TModel, TProp extends string, TValue> = TModel & {
  [key in TProp]: TValue;
};

export type ResolverResult<T> = T extends Promise<any> ? T : Promise<T>;

export type CustomContextFactory<TContext> = (
  context: ApolloContext
) => TContext;

export type ModelOptions<TContext = {}> = {
  context?: TContext | CustomContextFactory<TContext>;
  prefix?: string;
};

export type QueryContext<TContext, TMeta> = TContext &
  DispatcherMap<TMeta, { async: true; read: true }>;

export type FieldContext<TContext, TMeta> = TContext &
  DispatcherMap<TMeta, { async: true; read: true }>;

export type AtomContext<TContext, TMeta> = TContext &
  DispatcherMap<TMeta, { read: true }>;

export type MutationContext<TContext, TMeta> = TContext &
  DispatcherMap<TMeta, { async: true; read: true; write: true }>;

export type FieldResolver<
  TContext,
  TValue = any,
  TArgs = any,
  TResult = any
> = (
  value: TValue,
  args: TArgs,
  context: ApolloContext & TContext
) => TResult | Promise<TResult>;

export type RootResolver<TContext, TArgs = any, TResult = any> = (
  args: TArgs,
  context: TContext & ApolloContext
) => TResult | Promise<TResult>;

export type QueryOptions = { type?: string };

export type MutationOptions = { type?: string };

export type WithResolve<T extends (...args: any[]) => any> = {
  (...args: Parameters<T>): ReturnType<T>;
  resolve(...args: Parameters<T>): ReturnType<T>;
};

export type Dispatcher<TVariables, TData> = void extends TVariables
  ? () => ResolverResult<TData>
  : (variables: TVariables) => ResolverResult<TData>;

export type RemovePrefix<
  TPrefix extends string,
  TValue
> = TValue extends `${TPrefix}${infer TRest}` ? TRest : TValue;

export type NormalizeProps<T> = {
  [key in keyof T as T[key] extends never ? never : key]: T[key];
};

export type DispatcherMap<
  TMeta,
  TScopes extends Partial<Record<"async" | "read" | "write", boolean>>
> = NormalizeProps<{
  [key in `$${keyof TMeta & string}`]: TMeta[RemovePrefix<"$", key> &
    keyof TMeta] extends Atom<infer TData>
    ? TScopes extends { write: true }
      ? {
          (data: TData | ((prev: TData) => any)): void;
          (): TData;
        }
      : () => TData
    : TScopes extends { async: true }
    ? TMeta[RemovePrefix<"$", key> & keyof TMeta] extends Query<
        infer TVariables,
        infer TData
      >
      ? WithResolve<Dispatcher<TVariables, TData>> &
          (TScopes extends { write: true }
            ? // can refetch query if it is mutation scope
              { readonly refetch: Dispatcher<TVariables, TData> }
            : {})
      : // mutation dispatcher
      TMeta[RemovePrefix<"$", key> & keyof TMeta] extends Mutation<
          infer TVariables,
          infer TData
        >
      ? WithResolve<Dispatcher<TVariables, TData>>
      : never
    : never;
}>;

export type Atom<TData = any> = {
  type: "atom";
  model: Model;
  name: string;
  initial: TData | ((context: AtomContext<any, any>) => TData);
};

export type AtomOptions = { name?: string };

export type Model<TContext = {}, TMeta = {}> = {
  use<TOtherMeta>(meta: TOtherMeta): Model<TContext, TMeta & TOtherMeta>;

  query<TName extends string>(
    name: TName,
    document: DocumentNode
  ): Model<TContext, AddProp<TMeta, TName, Query<any, any>>>;

  query<TName extends string, TData, TVariables>(
    name: TName,
    document: TypedQueryDocumentNode<TData, TVariables>
  ): Model<TContext, AddProp<TMeta, TName, Query<TVariables, TData>>>;

  query<TAlias extends string, TName extends string, TVariables, TData>(
    name: `${TAlias}:${TName}`,
    resolver: RootResolver<QueryContext<TContext, TMeta>, TVariables, TData>,
    options?: QueryOptions
  ): Model<
    TContext,
    AddProp<TMeta, TAlias, Query<TVariables, { [key in TAlias]: TData }>>
  >;

  query<TName extends string, TVariables, TData>(
    name: TName,
    resolver: RootResolver<QueryContext<TContext, TMeta>, TVariables, TData>,
    options?: QueryOptions
  ): Model<
    TContext,
    AddProp<TMeta, TName, Query<TVariables, { [key in TName]: TData }>>
  >;

  mutation<TName extends string, TData, TVariables>(
    name: TName,
    document: TypedQueryDocumentNode<TData, TVariables>
  ): Model<TContext, AddProp<TMeta, TName, Mutation<TVariables, TData>>>;

  mutation<TName extends string, TVariables, TData>(
    name: TName,
    resolver: RootResolver<MutationContext<TContext, TMeta>, TVariables, TData>,
    options?: MutationOptions
  ): Model<
    TContext,
    AddProp<TMeta, TName, Mutation<TVariables, { [key in TName]: TData }>>
  >;

  atom<TName extends string, TData>(
    name: TName,
    data: TData | ((context: AtomContext<TContext, TMeta>) => TData),
    options?: AtomOptions
  ): Model<TContext, AddProp<TMeta, TName, Atom<TData>>>;

  type<
    TType extends string,
    TResolvers extends Record<
      string,
      FieldResolver<FieldContext<TContext, TMeta>, any, any, any>
    >
  >(
    type: TType,
    resolvers: TResolvers
  ): Model<TContext, AddProp<TMeta, TType, TResolvers>>;

  readonly meta: TMeta;

  init(client: Client): void;

  call<TCustomContext extends ApolloContext, TResult, TArgs extends any[]>(
    context: TCustomContext,
    action: (
      context: TCustomContext & MutationContext<TContext, TMeta>,
      ...args: TArgs
    ) => TResult,
    ...args: TArgs
  ): TResult;
};

export type CreateModel = {
  <TContext = {}>(options?: ModelOptions<TContext>): Model<TContext, {}>;
};

export type QueryHandler<TVariables, TData> = {
  get(
    ...args: [void extends TVariables ? [] : [variables: TVariables]]
  ): Promise<TData>;

  resolve(
    context: any,
    ...args: [void extends TVariables ? [] : [variables: TVariables]]
  ): Promise<TData>;
};

export type MutationHandler<TVariables, TData> = {
  call(
    ...args: [void extends TVariables ? [] : [variables: TVariables]]
  ): Promise<TData>;
};

export type UpdateRecipe<TData> =
  | TData
  | ((
      prevData: TData
    ) => TData extends Record<string, any>
      ? void
      : TData extends Array<any>
      ? void
      : TData);
