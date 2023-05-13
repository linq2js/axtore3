import type { ApolloClient, FetchPolicy } from "@apollo/client";
import type {
  ApolloError,
  MutationOptions,
  QueryOptions,
  ReactiveVar,
  Reference,
  StoreObject,
} from "@apollo/client/core";

import type { DocumentNode } from "graphql";
import gql from "graphql-tag";

export type NoInfer<T> = [T][T extends any ? 0 : never];

export type Client<T = any> = ApolloClient<T>;

export type ObjectType =
  | "atom"
  | "query"
  | "mutation"
  | "lazy"
  | "loadable"
  | "model";

export type Listener<T = void> = (e: T) => void;

export type Future<T> = Promise<T extends Promise<infer R> ? R : T>;

export type Equality<T> = (a: T, b: T) => boolean;

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

type NoVariables = { [key: string]: never };

export type VariablesOptions<TVariables, TOptions> =
  // no vars
  TVariables extends NoVariables
    ? // no options
      void extends TOptions
      ? // no args
        []
      : // options is optional
      undefined extends Extract<TOptions, undefined>
      ? [options?: Exclude<TOptions, undefined>]
      : [options: TOptions]
    : // no vars
    void extends TVariables
    ? // no options
      void extends TOptions
      ? // no args
        []
      : // options is optional
      undefined extends Extract<TOptions, undefined>
      ? [options?: Exclude<TOptions, undefined>]
      : [options: TOptions]
    : // vars is optional
    undefined extends Extract<TVariables, undefined>
    ? // no options
      void extends TOptions
      ? [options?: { variables?: TVariables }]
      : undefined extends Extract<TOptions, undefined>
      ? [
          options?: Exclude<TOptions, undefined> & {
            variables?: Exclude<TVariables, undefined>;
          }
        ]
      : [options?: TOptions & { variables?: Exclude<TVariables, undefined> }]
    : void extends TOptions
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
    ...args: NoInfer<
      VariablesOptions<TVariables, { fetchPolicy?: FetchPolicy } | undefined>
    >
  ): Promise<TData>;

  /**
   * get atom data
   * @param atom
   */
  get<TData>(atom: Atom<TData>): TData;

  /**
   * enqueue the fn to effect queue. the effect queue will be executed after executing of the current resolver
   * @param fn
   */
  effect(fn: (context: EffectContext) => VoidFunction | void): void;

  effect(
    signals: Signal | Signal[],
    fn: (context: EffectContext) => void
  ): void;
};

export type EffectContext = {
  readonly data: any;
  refetch(): void;
  evict(field?: string[]): void;
};

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
  /**
   * get entity id from its type and id
   * @param type
   * @param id
   */
  identity(type: string, id: any): string | undefined;

  /**
   * change atom data
   * @param atom
   * @param options
   */
  set<TData>(atom: Atom<TData>, options: { data: UpdateRecipe<TData> }): void;

  /**
   * change query data
   * @param query
   * @param args
   */
  set<TVariables, TData>(
    query: Query<TVariables, TData>,
    ...args: VariablesOptions<TVariables, { data: UpdateRecipe<TData> }>
  ): void;

  /**
   * change entity prop values
   * @param type
   * @param id
   * @param fields
   */
  set<TData>(
    type: string,
    id: any,
    fields: { [key in keyof TData]?: UpdateRecipe<TData[key]> }
  ): void;

  /**
   * evict multiple entities
   * @param entities
   * @param fields
   */
  set<T extends StoreObject | Reference>(
    entities: T | T[],
    fields: { [key in keyof T]?: UpdateRecipe<T[key]> }
  ): void;

  /**
   * evict single entity
   * @param type
   * @param id
   */
  evict(type: string | TypeDef, id: any): void;

  /**
   * evict query data
   * @param query
   * @param fields
   */
  evict<TVariables, TData>(
    query: Query<TVariables, TData>,
    fields?: (keyof TData)[] | Record<keyof TData, any>
  ): void;
  evict<T extends StoreObject | Reference>(entities: T | T[]): void;

  /**
   * refetch specific query with an options
   * @param query
   * @param args
   */
  refetch<TVariables, TData>(
    query: Query<TVariables, TData>,
    ...args: VariablesOptions<
      TVariables,
      { fetchPolicy?: FetchPolicy } | undefined
    >
  ): Promise<TData>;

  /**
   * call mutation
   * @param mutation
   * @param args
   */
  call<TVariables = any, TData = any>(
    mutation: Mutation<TVariables, TData>,
    ...args: VariablesOptions<TVariables, void>
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
  readonly dynamic: boolean;
  use(client: Client): QueryHandler<TVariables, TData>;
  wrap<TProp extends string, TResult = void>(
    prop: TProp,
    options?: {
      map?: Resolver<QueryContext & { args: TVariables }, TData, TResult>;
      cache?: boolean;
      init?: (args: TVariables, context: QueryContext) => void | Promise<void>;
    }
  ): Query<TVariables, { [key in TProp]: TResult }>;
};

export type a = MutationOptions;

export type Mutation<TVariables = any, TData = any> = WithType<"mutation"> & {
  readonly document: DocumentNode;
  readonly dynamic: boolean;
  use(client: Client): MutationHandler<TVariables, TData>;
  wrap<TProp extends string, TResult = void>(
    prop: TProp,
    options: {
      map?: Resolver<MutationContext & { args: TVariables }, TData, TResult>;
      prepare?: (
        args: TVariables,
        context: MutationContext
      ) => void | Promise<void>;
    }
  ): Mutation<TVariables, { [key in TProp]: TResult }>;
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

  mergeOptions(
    options?: Omit<QueryOptions<any, any>, "query"> &
      OperationEvents<TVariables, TData>
  ): QueryOptions<any, any>;
};

export type OperationEvents<TVariables, TData> = {
  onCompleted?(data: TData, variables: TVariables): void;
  onError?(error: ApolloError, variables: TVariables): void;
};

export type AtomHandler<TData> = {
  readonly reactiveVar: ReactiveVar<TData>;
  get(): TData;
  set(options: { data: UpdateRecipe<TData> }): void;
  subscribe(options: { onChange: (data: TData) => void }): VoidFunction;
};

export type CreateAtomOptions<TData> = {
  key?: string;
  /**
   * indicate type of atom data, once atom data is changed, type patcher for the given type will be applied
   */
  type?: TypeDef;
  equal?: Equality<TData>;
};

export type MutationHandler<TVariables, TData> = {
  call(...args: VariablesOptions<TVariables, void>): Promise<TData>;
  mergeOptions(
    options?: Omit<MutationOptions<any, any>, "mutation"> &
      OperationEvents<TVariables, TData>
  ): MutationOptions<any, any>;
};

export type ExtractPrefix<TExpected, TReceived> = TReceived extends TExpected
  ? TReceived
  : TReceived extends `${infer TPrefix}:${string}`
  ? TPrefix extends TExpected
    ? TPrefix
    : never
  : never;

export type ResolverMap<TData, TContext> = {
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
    when: Signal | Signal[];
    fields?: (keyof TData)[] | Record<keyof TData, any>;
  };

  refetch?: {
    when: Signal | Signal[];
    variables?: TVariables;
  };

  /**
   * when the query data is changed, axtore uses this equality function to compare prev to next data, change notification will be triggered if they are different
   * @param prev
   * @param next
   * @returns
   */
  equal?: Equality<TData>;
} & OperationEvents<TVariables, TData>;

export type CreateStaticMutationOptions<TData = any> =
  CreateMutationOptions<TData> & {
    /**
     * operation name
     */
    operation?: string;
    types?: TypeDef[];
    resolve?: ResolverMap<TData, MutationContext>;
  };

export type VariableBuilderContext = {
  get<TData>(atom: Atom<TData>): TData;
};

export type CreateDynamicMutationOptions<TData = any> =
  CreateMutationOptions<TData> & { type?: TypeDef };

export type CreateStaticQueryOptions<TVariables = any, TData = any> = Omit<
  CreateQueryOptions<TVariables, TData>,
  "variables"
> & {
  /**
   * operation name
   */
  operation?: string;
  types?: TypeDef[];
  variables?:
    | Partial<TVariables>
    | {
        [key in keyof TVariables]?:
          | Atom<Exclude<TVariables[key], undefined>>
          | TVariables[key];
      }
    | ((context: VariableBuilderContext) => Partial<TVariables>);
  resolve?: ResolverMap<TData, QueryContext>;
};

export type CreateDynamicQueryOptions<
  TVariables = any,
  TData = any
> = CreateQueryOptions<TVariables, TData> & { type?: TypeDef };

export type CreateMutationOptions<TVariables = any, TData = any> = {
  context?: any;
  fetchPolicy?: MutationFetchPolicy;
  variables?: Partial<TVariables>;
} & OperationEvents<TVariables, TData>;

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

export type ConditionalContext = {
  client: Client;

  /**
   * read atom data
   * @param atom
   */
  get<TData>(atom: Atom<TData>): TData;

  /**
   * read query cached data, no query call occurs
   * @param query
   * @param args
   */
  get<TVariables, TData>(
    query: Query<TVariables, TData>,
    ...args: VariablesArgs<TVariables>
  ): TData | undefined;
};

export type Condition = (context: ConditionalContext) => boolean;

export type SignalDispatcher<TContext> = (context: TContext) => void;

export type Signal<TContext = any> = (
  client: Client,
  dispatch: SignalDispatcher<TContext>
) => VoidFunction;

export type InferDefinitionType<K, T> = T extends UnknownFieldNameOperation
  ? T extends Query<infer V, infer D>
    ? Query<V, { [key in K & string]: D }>
    : T extends Mutation<infer V, infer D>
    ? Mutation<V, { [key in K & string]: D }>
    : never
  : T extends (name: string) => infer R
  ? R
  : T;

export type LazyResultOptions = {
  interval?: number;
};

export type LazyResult<T> = WithType<"lazy"> & {
  readonly value: T;
  readonly loader: () => Promise<T>;
  readonly options: LazyResultOptions;
};

export type LoadableSource<T = any> = {
  (): Loadable<T>;
  invalidate(): void;
};

export type Loadable<T = any> = {
  readonly type: "loadable";
  readonly data: T | undefined;
  readonly promise: Promise<T>;
  readonly loading: boolean;
  readonly error: unknown | undefined;
} & PromiseLike<T>;

export type UpdateRecipe<TData> =
  | TData
  | ((
      prevData: TData
    ) => TData extends Record<string, any>
      ? void
      : TData extends Array<any>
      ? void
      : TData);

const EMPTY_RESOLVERS = {};

export { EMPTY_RESOLVERS, gql };
