import { ApolloClient, FetchPolicy, gql } from "@apollo/client";
import {
  MutationOptions,
  QueryOptions,
  ReactiveVar,
  Reference,
  StoreObject,
} from "@apollo/client/core";

import { DocumentNode } from "graphql";
import { createRestResolver } from "./rest/createRestResolver";

export type NoInfer<T> = [T][T extends any ? 0 : never];

export type Client<T = any> = ApolloClient<T>;

export type ObjectType = "atom" | "query" | "mutation" | "lazy" | "store";

export type Listener<T = void> = (e: T) => void;

export type Future<T> = Promise<T extends Promise<infer R> ? R : T>;

export type MutationFetchPolicy = Extract<
  FetchPolicy,
  "network-only" | "no-cache"
>;

export type VariablesArgs<TVariables> = TVariables extends void
  ? []
  : [variables: TVariables];

export type VariablesProps<
  TVariables,
  TProp extends string = "variables"
> = TVariables extends void ? {} : { [key in TProp]: TVariables };

export type WithVariables<TVariables, TOptions> = TOptions & {
  variables: TVariables;
};

export type VariablesOptions<TVariables, TOptions> =
  // no vars
  TVariables extends void
    ? // no options
      TOptions extends void
      ? // no args
        []
      : // options is optional
      Exclude<TOptions, {}> extends undefined
      ? [options?: Exclude<TOptions, undefined>]
      : [options: TOptions]
    : // vars is optional
    Exclude<TVariables, {}> extends undefined
    ? // no options
      TOptions extends void
      ? [options?: { variables?: TVariables }]
      : Exclude<TOptions, {}> extends undefined
      ? [
          options?: Exclude<TOptions, undefined> & {
            variables?: Exclude<TVariables, undefined>;
          }
        ]
      : [options?: TOptions & { variables?: Exclude<TVariables, undefined> }]
    : TOptions extends void
    ? [options: { variables: TVariables }]
    : [options: TOptions & { variables: TVariables }];

export type AtomContext = {
  get<TData>(atom: Atom<TData>): TData;
};

export type QueryContext = {
  readonly context: any;
  readonly self: unknown;
  readonly client: Client;

  /**
   * get query data
   * @param query
   * @param args
   */
  get<TVariables, TData>(
    query: Query<TVariables, TData>,
    ...args: NoInfer<VariablesOptions<TVariables, void>>
  ): Promise<TData>;

  /**
   * get atom data
   * @param atom
   */
  get<TData>(atom: Atom<TData>): TData;

  call<TVariables, TData>(
    mutation: Mutation<TVariables, TData>,
    ...args: VariablesOptions<TVariables, undefined>
  ): Promise<TData>;

  /**
   * call specific function with current query context
   * @param fn
   */
  call<R>(fn: (args: any, context: QueryContext) => R): R;

  /**
   * call specific function with current query context
   * @param fn
   * @param args
   */
  call<A, R>(fn: (args: A, context: QueryContext) => R, args: A): R;

  /**
   * enqueue the fn to effect queue. the effect queue will be executed after executing of the current resolver
   * @param fn
   */
  effect(fn: (context: EffectContext) => VoidFunction | void): void;

  on<TData>(atom: Atom<TData>, callback: (data: TData) => void): VoidFunction;
  on<TVariables, TData>(
    query: Query<TVariables, TData>,
    callback: (data: TData) => void
  ): VoidFunction;
};

export type EffectContext = { readonly data: any; refetch(): void };

export type Resolver<TContext, TArgs = any, TResult = any> = (
  args: TArgs,
  context: TContext
) => TResult | LazyResult<TResult> | Promise<TResult>;

export type QueryResolver<TArgs = any, TResult = any> = Resolver<
  QueryContext,
  TArgs,
  TResult
>;

export type MutationContext = QueryContext & {
  set<TData>(atom: Atom<TData>, options: { data: UpdateRecipe<TData> }): void;
  set<TVariables, TData>(
    query: Query<TVariables, TData>,
    ...args: VariablesOptions<TVariables, { data: UpdateRecipe<TData> }>
  ): void;
  set<T extends StoreObject | Reference>(
    entities: T | T[],
    fields: { [key in keyof T]?: UpdateRecipe<T[key]> }
  ): void;
  evict(type: string | TypeDef, id: any): void;
  evict<TVariables, TData>(
    query: Query<TVariables, TData>,
    fields?: (keyof TData)[] | Record<keyof TData, any>
  ): void;
  evict<T extends StoreObject | Reference>(entities: T | T[]): void;

  refetch<TVariables, TData>(
    query: Query<TVariables, TData>,
    ...args: VariablesOptions<
      TVariables,
      { fetchPolicy?: FetchPolicy } | undefined
    >
  ): Promise<TData>;
};

export type MutationResolver<TArgs = unknown, TResult = unknown> = Resolver<
  MutationContext,
  TArgs,
  TResult
>;

export type TypeDef = {
  name: string;
  fields?: Record<string, TypeDef | QueryResolver | [QueryResolver, TypeDef]>;
  /**
   * internal use only
   */
  __fieldMappers?: Record<string, Function>;
};

export type WithType<TType extends ObjectType = any> = {
  readonly type: TType;
};

export type Atom<TData = any> = WithType<"atom"> & {
  readonly document: DocumentNode;
  use(client: Client): AtomHandler<TData>;
};

export type Query<TVariables = any, TData = any> = WithType<"query"> & {
  readonly document: DocumentNode;
  use(client: Client): QueryHandler<TVariables, TData>;
  mergeOptions(
    options?: Omit<QueryOptions<any, any>, "query">
  ): QueryOptions<any, any>;
};

export type a = MutationOptions;

export type Mutation<TVariables = any, TData = any> = WithType<"mutation"> & {
  readonly document: DocumentNode;
  use(client: Client): MutationHandler<TVariables, TData>;
  mergeOptions(
    options?: Omit<MutationOptions<any, any>, "mutation">
  ): MutationOptions<any, any>;
};

export type QueryHandler<TVariables = any, TData = any> = {
  get(...args: VariablesOptions<TVariables, void>): Promise<TData>;
  refetch(
    ...args: VariablesOptions<
      TVariables,
      { fetchPolicy?: FetchPolicy } | undefined
    >
  ): Promise<TData>;
  subscribe(
    ...args: VariablesOptions<TVariables, { onChange: (data: TData) => void }>
  ): VoidFunction;
  /**
   * update query data
   * @param options
   */
  set(
    ...args: VariablesOptions<TVariables, { data: UpdateRecipe<TData | null> }>
  ): void;
};

export type AtomHandler<TData> = {
  readonly reactiveVar: ReactiveVar<TData>;
  get(): TData;
  set(options: { data: UpdateRecipe<TData> }): void;
  subscribe(options: { onChange: (data: TData) => void }): VoidFunction;
};

export type CreateAtomOptions<TData> = {
  key?: string;
  equal?: (prev: TData, next: TData) => boolean;
};

export type MutationHandler<TVariables, TData> = {
  call(...args: VariablesOptions<TVariables, void>): Promise<TData>;
};

export type ExtractPrefix<TExpected, TReceived> = TReceived extends TExpected
  ? TReceived
  : TReceived extends `${infer TPrefix}:${string}`
  ? TPrefix extends TExpected
    ? TPrefix
    : never
  : never;

export type MixedResolverMap<TData, TContext> = {
  [key in keyof TData | `${keyof TData & string}:${string}`]?:
    | Atom<TData[ExtractPrefix<keyof TData, key>]>
    | Resolver<TContext, any, TData[ExtractPrefix<keyof TData, key>]>
    | [
        Resolver<
          TContext,
          any,
          TData[ExtractPrefix<keyof TData, key>] extends Array<infer I>
            ? Partial<I>[]
            : Partial<TData[ExtractPrefix<keyof TData, key>]>
        >,
        ResolverType<ItemType<TData[ExtractPrefix<keyof TData, key>]>>
      ];
};

export type ClientOnlyResolverMap<TVariables, TData, TContext> = {
  [key in keyof TData | `${keyof TData & string}:${string}`]:
    | Atom<TData[ExtractPrefix<keyof TData, key>]>
    | Resolver<TContext, TVariables, TData[ExtractPrefix<keyof TData, key>]>
    | [
        Resolver<
          TContext,
          TVariables,
          TData[ExtractPrefix<keyof TData, key>] extends Array<infer I>
            ? Partial<I>[]
            : Partial<TData[ExtractPrefix<keyof TData, key>]>
        >,
        ResolverType<ItemType<TData[ExtractPrefix<keyof TData, key>]>>
      ];
};

export type CreateQueryOptions<TVariables = any, TData = any> = {
  key?: string;
  context?: any;
  fetchPolicy?: FetchPolicy;

  /**
   * set default variable values
   */
  variables?: Partial<TVariables>;

  evict?: {
    when: Listenable | Listenable[];
    fields?: (keyof TData)[] | Record<keyof TData, any>;
  };

  refetch?: {
    when: Listenable | Listenable[];
    variables?: TVariables;
  };

  /**
   * when the query data is changed, axtore uses this equality function to compare prev to next data, change notification will be triggered if they are different
   * @param prev
   * @param next
   * @returns
   */
  equal?: (prev: TData, next: TData) => boolean;
};

export type CreateMutationOptions<TVariables = any> = {
  context?: any;
  fetchPolicy?: MutationFetchPolicy;
  variables?: Partial<TVariables>;
};

export type Optional<TOptions, TKey extends keyof TOptions> = Omit<
  TOptions,
  TKey
> &
  Partial<Pick<TOptions, TKey>>;

export type ItemType<T> = T extends Array<infer I> ? I : T;

export type ResolverType<T> = {
  name: string;
  fields?: { [key in keyof T]?: TypeDef | QueryResolver<unknown, T[key]> };
};

export type InferOperationInput<TVariables> = TVariables extends void
  ? void
  : { input: TVariables };

export type UnknownFieldNameOperation = {
  fieldName: null;
};

export type BuilderContext = {
  query<TVariables, TData>(
    options?: CreateQueryOptions<TVariables, TData>
  ): (name: string) => Query<TVariables, TData>;

  query<TVariables, TData>(
    document: DocumentNode,
    options?: CreateQueryOptions<TVariables, TData>
  ): Query<TVariables, TData>;

  /**
   * create static query from named operation definition in the store document
   * @param operationName
   * @param options
   */
  query<TVariables, TData>(
    operationName: string,
    options?: CreateQueryOptions<TVariables, TData>
  ): Query<TVariables, TData>;

  query<TField extends string, TVariables, TData>(
    field: TField,
    resolver: Resolver<QueryContext, TVariables, TData>,
    typeDef: TypeDef,
    options?: CreateQueryOptions<TVariables, TData>
  ): Query<TVariables, { [key in TField]: TData }>;

  query<TField extends string, TVariables, TData>(
    field: TField,
    resolver: Resolver<QueryContext, TVariables, TData>,
    options?: CreateQueryOptions<TVariables, TData>
  ): Query<TVariables, { [key in TField]: TData }>;

  query<TVariables, TData>(
    resolver: Resolver<QueryContext, TVariables, TData>,
    typeDef: TypeDef,
    options?: CreateQueryOptions<TVariables, TData>
  ): Query<TVariables, TData> & UnknownFieldNameOperation;

  query<TVariables, TData>(
    resolver: Resolver<QueryContext, TVariables, TData>,
    options?: CreateQueryOptions<TVariables, TData>
  ): Query<TVariables, TData> & UnknownFieldNameOperation;

  mutation<TVariables, TData>(
    options?: CreateMutationOptions<TVariables>
  ): Mutation<TVariables, TData>;

  mutation<TVariables, TData>(
    options?: CreateMutationOptions<TVariables>
  ): (name: string) => Mutation<TVariables, TData>;

  /**
   * create static mutation from named operation definition in the store document
   * @param operationName
   * @param options
   */
  mutation<TVariables, TData>(
    operationName: string,
    options?: CreateMutationOptions<TVariables>
  ): Mutation<TVariables, TData>;

  mutation<TVariables, TData>(
    resolver: Resolver<MutationContext, TVariables, TData>,
    options?: CreateMutationOptions<TVariables>
  ): Mutation<TVariables, TData> & UnknownFieldNameOperation;

  mutation<TVariables, TData>(
    resolver: Resolver<MutationContext, TVariables, TData>,
    typeDef: TypeDef,
    options?: CreateMutationOptions<TVariables>
  ): Mutation<TVariables, TData> & UnknownFieldNameOperation;

  mutation<TField extends string, TVariables, TData>(
    field: TField,
    resolver: Resolver<MutationContext, TVariables, TData>,
    typeDef: TypeDef,
    options?: CreateMutationOptions<TVariables>
  ): Mutation<TVariables, { [key in TField]: TData }>;

  mutation<TField extends string, TVariables, TData>(
    field: TField,
    resolver: Resolver<MutationContext, TVariables, TData>,
    options?: CreateMutationOptions<TVariables>
  ): Mutation<TVariables, { [key in TField]: TData }>;

  atom<TData>(
    data: TData | ((context: AtomContext) => TData),
    options?: NoInfer<CreateAtomOptions<TData>>
  ): Atom<TData>;

  lazy<T>(
    value: T,
    loader: LazyResult<T>["loader"],
    options?: LazyResultOptions
  ): LazyResult<T>;

  /**
   * create a listenable object from onChange event of the query
   * @param query
   * @param args
   */
  changed<TVariables, TData>(
    query: Query<TVariables, TData>,
    ...args: VariablesArgs<TVariables>
  ): Listenable;

  after(ms: number): Listenable;

  /**
   * create a listenable object from onChange event of the atom
   * @param atom
   */
  changed<TData>(atom: Atom<TData>): Listenable;

  readonly rest: typeof createRestResolver;
};

export type Listenable = (
  client: Client,
  listener: VoidFunction
) => VoidFunction;

export type DefinitionBuilder<
  TDefs,
  TDefinition extends Record<string, Atom | Query | Mutation | Function>
> = (context: BuilderContext, defs: TDefs) => TDefinition;

export type InferDefinitionType<K, T> = T extends UnknownFieldNameOperation
  ? T extends Query<infer V, infer D>
    ? Query<V, { [key in K & string]: D }>
    : T extends Mutation<infer V, infer D>
    ? Mutation<V, { [key in K & string]: D }>
    : never
  : T extends (name: string) => infer R
  ? R
  : T;

export type Store<TDefs = {}> = WithType<"store"> & {
  document: DocumentNode;
  typeDefs: TypeDef[];

  /**
   * create a new store has definition which is combined from the old one and the return value of the builder
   * @param builder
   */
  use<TNewDefs extends Record<string, Atom | Query | Mutation | Function>>(
    builder: DefinitionBuilder<NoInfer<TDefs>, TNewDefs>
  ): Store<
    TDefs & { [key in keyof TNewDefs]: InferDefinitionType<key, TNewDefs[key]> }
  >;

  use<TOtherDefs extends Record<string, Query | Mutation | Atom>>(
    defs: TOtherDefs
  ): Store<TDefs & TOtherDefs>;

  use(document: DocumentNode): Store<TDefs>;

  use(client: Client): StoreHandler<TDefs>;

  use<T>(client: Client, callback: (handler: StoreHandler<TDefs>) => T): T;

  /**
   * add type definitions / resolvers
   * @param types
   */
  use(typeDef: TypeDef, ...otherTypeDefs: TypeDef[]): Store<TDefs>;

  defs: TDefs;
};

export type StoreHandler<TDefs> = {
  [key in keyof TDefs]: TDefs[key] extends Query<infer TVariables, infer TData>
    ? QueryHandler<TVariables, TData>
    : TDefs[key] extends Mutation<infer TVariables, infer TData>
    ? MutationHandler<TVariables, TData>
    : TDefs[key] extends Atom<infer TData>
    ? AtomHandler<TData>
    : never;
};

export type LazyResultOptions = {
  interval?: number;
};

export type LazyResult<T> = WithType<"lazy"> & {
  readonly value: T;
  readonly loader: () => Promise<T>;
  readonly options: LazyResultOptions;
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

export type Create = {
  (): Store<{}>;
  (document: DocumentNode): Store<{}>;
  <TNewDefs extends Record<string, Atom | Query | Mutation>>(
    builder: DefinitionBuilder<{}, TNewDefs>
  ): Store<TNewDefs>;
};

const EMPTY_RESOLVERS = {};

export { EMPTY_RESOLVERS };

export { gql } from "@apollo/client";
