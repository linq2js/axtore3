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

export type CreateQueryOptions<TVariables, TData> = {
  key?: string;
  /**
   * define query resolvers
   */
  resolve?: MixedResolverMap<TData, QueryContext>;
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

export type CreateMutationOptions<TVariables, TData> = {
  resolve?: MixedResolverMap<TData, MutationContext>;
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

export type InferQueryInput<TVariables> = TVariables extends void
  ? void
  : { input: TVariables };

export type BuilderContext = {
  query<TVariables, TData>(
    options: NoInfer<
      Omit<CreateQueryOptions<TVariables, TData>, "resolve"> & {
        client: true;
        resolve: ClientOnlyResolverMap<
          InferQueryInput<TVariables>,
          TData,
          QueryContext
        >;
      }
    >
  ): Query<InferQueryInput<TVariables>, TData>;

  query<TVariables, TData>(
    options?: NoInfer<CreateQueryOptions<TVariables, TData>>
  ): Query<TVariables, TData>;

  atom<TData>(
    data: TData | ((context: AtomContext) => TData),
    options?: NoInfer<CreateAtomOptions<TData>>
  ): Atom<TData>;

  mutation<TVariables, TData>(
    options?: NoInfer<CreateMutationOptions<TVariables, TData>>
  ): Mutation<TVariables, TData>;

  mutation<TVariables, TData>(
    options: NoInfer<
      Omit<CreateMutationOptions<TVariables, TData>, "resolve"> & {
        client: true;
        resolve: ClientOnlyResolverMap<
          InferQueryInput<TVariables>,
          TData,
          MutationContext
        >;
      }
    >
  ): Mutation<InferQueryInput<TVariables>, TData>;

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

export type DefinitionBuilder<TDefs, TDefinition extends WithType> = (
  context: BuilderContext,
  defs: TDefs
) => TDefinition;

export type Store<TDefs = {}> = WithType<"store"> & {
  document: DocumentNode;
  typeDefs: TypeDef[];

  use<TOtherDefs extends Record<string, Query | Mutation | Atom>>(
    defs: TOtherDefs
  ): Store<TDefs & TOtherDefs>;

  /**
   * add definitions from another stores
   * @param s1
   */
  use<T1>(s1: Store<T1>): Store<TDefs & T1>;

  /**
   * add definitions from another stores
   * @param s1
   * @param s2
   */
  use<T1, T2>(s1: Store<T1>, s2: Store<T2>): Store<TDefs & T1 & T2>;

  /**
   * add definitions from another stores
   * @param s1
   * @param s2
   * @param s3
   */
  use<T1, T2, T3>(
    s1: Store<T1>,
    s2: Store<T2>,
    s3: Store<T3>
  ): Store<TDefs & T1 & T2 & T3>;

  /**
   * add definitions from another stores
   * @param s1
   * @param s2
   * @param s3
   * @param s4
   */
  use<T1, T2, T3, T4>(
    s1: Store<T1>,
    s2: Store<T2>,
    s3: Store<T3>,
    s4: Store<T4>
  ): Store<TDefs & T1 & T2 & T3 & T4>;

  /**
   * add definitions from another stores
   * @param s1
   * @param s2
   * @param s3
   * @param s4
   * @param s5
   */
  use<T1, T2, T3, T4, T5>(
    s1: Store<T1>,
    s2: Store<T2>,
    s3: Store<T3>,
    s4: Store<T4>,
    s5: Store<T5>
  ): Store<TDefs & T1 & T2 & T3 & T4 & T5>;

  /**
   * add definitions from another stores
   * @param s1
   * @param s2
   * @param s3
   * @param s4
   * @param s5
   */
  use<T1, T2, T3, T4, T5>(
    s1: Store<T1>,
    s2: Store<T2>,
    s3: Store<T3>,
    s4: Store<T4>,
    s5: Store<T5>
  ): Store<TDefs & T1 & T2 & T3 & T4 & T5>;

  /**
   * add definitions from another stores
   * @param s1
   * @param s2
   * @param s3
   * @param s4
   * @param s5
   * @param s6
   */
  use<T1, T2, T3, T4, T5, T6>(
    s1: Store<T1>,
    s2: Store<T2>,
    s3: Store<T3>,
    s4: Store<T4>,
    s5: Store<T5>,
    s6: Store<T6>
  ): Store<TDefs & T1 & T2 & T3 & T4 & T5 & T6>;

  /**
   * add definitions from another stores
   * @param s1
   * @param s2
   * @param s3
   * @param s4
   * @param s5
   * @param s6
   * @param s7
   */
  use<T1, T2, T3, T4, T5, T6, T7>(
    s1: Store<T1>,
    s2: Store<T2>,
    s3: Store<T3>,
    s4: Store<T4>,
    s5: Store<T5>,
    s6: Store<T6>,
    s7: Store<T7>
  ): Store<TDefs & T1 & T2 & T3 & T4 & T5 & T6 & T7>;

  /**
   * add definitions from another stores
   * @param s1
   * @param s2
   * @param s3
   * @param s4
   * @param s5
   * @param s6
   * @param s7
   * @param s8
   */
  use<T1, T2, T3, T4, T5, T6, T7, T8>(
    s1: Store<T1>,
    s2: Store<T2>,
    s3: Store<T3>,
    s4: Store<T4>,
    s5: Store<T5>,
    s6: Store<T6>,
    s7: Store<T7>,
    s8: Store<T8>
  ): Store<TDefs & T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8>;

  /**
   * add definitions from another stores
   * @param s1
   * @param s2
   * @param s3
   * @param s4
   * @param s5
   * @param s6
   * @param s7
   * @param s8
   * @param s9
   */
  use<T1, T2, T3, T4, T5, T6, T7, T8, T9>(
    s1: Store<T1>,
    s2: Store<T2>,
    s3: Store<T3>,
    s4: Store<T4>,
    s5: Store<T5>,
    s6: Store<T6>,
    s7: Store<T7>,
    s8: Store<T8>,
    s9: Store<T9>
  ): Store<TDefs & T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8 & T9>;

  /**
   * add type definitions / resolvers
   * @param types
   */
  use(...types: TypeDef[]): Store<TDefs>;

  /**
   * add definition
   * @param name
   * @param definition
   */
  use<TName extends string, TDefinition extends WithType>(
    name: `${TName}:${string}` | TName,
    definition: TDefinition | DefinitionBuilder<NoInfer<TDefs>, TDefinition>
  ): Store<TDefs & { [key in TName]: TDefinition }>;

  use(document: DocumentNode): Store<TDefs>;

  use(client: Client): StoreHandler<TDefs>;

  use<T>(client: Client, callback: (handler: StoreHandler<TDefs>) => T): T;

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

/// test

export type Create = {
  (document: DocumentNode): Store<{}>;
};

const EMPTY_RESOLVERS = {};

export { EMPTY_RESOLVERS };

export { gql } from "@apollo/client";
