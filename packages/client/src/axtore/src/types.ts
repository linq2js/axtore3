import { DocumentNode, TypedQueryDocumentNode } from "graphql";

import {
  ApolloClient,
  ApolloError,
  ApolloQueryResult,
  ObservableQuery,
} from "@apollo/client";

export type ObjectType =
  | "state"
  | "query"
  | "mutation"
  | "lazy"
  | "loadable"
  | "model";

export type ApolloContext = { client: Client };

export type NoInfer<T> = [T][T extends any ? 0 : never];

export type Client<TCacheShape = any> = ApolloClient<TCacheShape>;

export type Query<TVariables = any, TData = any> = {
  type: "query";
  name: string;
  document: DocumentNode;
  resolver?: RootResolver<any, TVariables, TData>;
  model: Model<any, any>;
  options: QueryOptions;
  mergeOptions(options?: any): any;
};

export type OperationEvents<TVariables, TData> = {
  onCompleted?(data: TData, variables: TVariables): void;
  onError?(error: ApolloError, variables: TVariables): void;
};

export type Mutation<TVariables = any, TData = any> = {
  type: "mutation";
  name: string;
  document: DocumentNode;
  resolver?: RootResolver<any, TVariables, TData>;
  model: Model<any, any>;
  options: QueryOptions;
  mergeOptions(options?: any): any;
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

export type Extras<TResult = any, TArgs extends any[] = []> = (
  context: ExtrasContext,
  ...args: TArgs
) => TResult;

export type ExtrasContext = ContextBase;

export type ContextBase = {
  readonly client: Client;
  /**
   * an shared object that persists across query calls
   */
  readonly shared: any;
  /**
   * return lastData of the query/mutation
   */
  readonly lastData: any;
  delay(ms: number): Promise<void>;
  use<TResult, TArgs extends any[]>(
    extras: Extras<TResult, TArgs>,
    ...args: TArgs
  ): TResult;
};

export type QueryContext<TContext, TMeta> = ContextBase &
  TContext &
  DispatcherMap<TMeta, { async: true; read: true }> & {
    readonly lazy: LazyFactory;
  };

export type FieldContext<TContext, TMeta> = ContextBase &
  TContext &
  DispatcherMap<TMeta, { async: true; read: true }> & {
    readonly lazy: LazyFactory;
  };

export type StateContext<TContext, TMeta> = Omit<ContextBase, "lastData"> &
  TContext &
  DispatcherMap<TMeta, { read: true }>;

export type MutationContext<TContext, TMeta> = ContextBase &
  TContext &
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
) => TResult | Promise<TResult> | Lazy<TResult>;

export type RootResolver<TContext, TArgs = any, TResult = any> = (
  args: TArgs,
  context: TContext & ApolloContext
) => TResult | Promise<TResult> | Lazy<TResult>;

export type ConcurrencyOptions = { debounce?: number; throttle?: number };

export type QueryOptions = {
  /**
   * specify type name of dynamic mutation's returned value
   */
  type?: string;
  /**
   * the query will do evict its data whenever its dependencies changed
   * this makes the observable query / query hook do refetching immediately
   * by default, the query does soft refetch and the refetching process runs in background, no loading status changed
   */
  hardRefetch?: boolean;
} & ConcurrencyOptions;

export type MutationOptions = {
  /**
   * specify type name of dynamic mutation's returned value
   */
  type?: string;
} & ConcurrencyOptions;

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

export type DispatcherScopes = Partial<
  Record<"async" | "read" | "write", boolean>
>;

export type StateDispatcher<TScopes extends DispatcherScopes, TData> = {
  (): TData;
  on(listeners: { change?: (data: TData) => void }): VoidFunction;
} & (TScopes extends { write: true }
  ? {
      (data: TData | ((prev: TData) => any)): void;
    }
  : {});

export type QueryDispatcher<
  TScopes extends DispatcherScopes,
  TVariables,
  TData
> = WithResolve<Dispatcher<TVariables, TData>> &
  (TScopes extends { write: true }
    ? {
        readonly refetch: Dispatcher<TVariables, TData> & {
          /**
           * refetch all queries that have same graphql document but different variables
           */
          all(): void;
        };

        /**
         * remove the query data from the cache
         */
        readonly evict: Dispatcher<TVariables, TData> & {
          /**
           * evict all queries that have same graphql document but different variables
           */
          all(): void;
        };

        /**
         * In normal, when we dispatch $queryName(),
         * model calls client.query() to fetch query data, and client will handle local resolver for dynamic query.
         * In this case, model calls query resolver directly without going through Apollo client, so no data fetching / caching process happens.
         * In case of the query is static query, model does data fetching with no-cache policy.
         */
        readonly resolve: Dispatcher<TVariables, TData>;

        /**
         * return true if the query is already fetched
         */
        readonly called: Dispatcher<TVariables, TData>;

        /**
         * get current data of the query. Return null if query is not fetched yet
         */
        readonly data: Dispatcher<TVariables, TData | undefined>;

        /**
         * register query listeners
         * @param listeners
         * @param args
         */
        on(
          listeners: { change?: (data: TData) => void },
          ...args: VariablesArgs<TVariables>
        ): VoidFunction;

        /**
         * change query data
         * @param dataOrRecipe
         * @param args
         */
        set(
          dataOrRecipe: UpdateRecipe<TData>,
          ...args: VariablesArgs<TVariables>
        ): Promise<void>;
      }
    : {});

export type MutationDispatcher<TVariables, TData> = WithResolve<
  Dispatcher<TVariables, TData>
>;

export type InferDispatcher<
  TScopes extends DispatcherScopes,
  T
> = T extends State<infer TData>
  ? StateDispatcher<TScopes, TData>
  : TScopes extends { async: true }
  ? T extends Query<infer TVariables, infer TData>
    ? QueryDispatcher<TScopes, TVariables, TData>
    : T extends Mutation<infer TVariables, infer TData>
    ? MutationDispatcher<TVariables, TData>
    : never
  : never;

export type DispatcherMap<
  TMeta,
  TScopes extends DispatcherScopes
> = NormalizeProps<{
  [key in `$${keyof TMeta & string}`]: InferDispatcher<
    TScopes,
    TMeta[RemovePrefix<"$", key> & keyof TMeta]
  >;
}>;

export type State<TData = any> = {
  type: "state";
  model: Model<any, any>;
  name: string;
  initial: TData | ((context: StateContext<any, any>) => TData);
};

export type Effect<TContext = {}, TMeta = {}> = (
  context: MutationContext<TContext, TMeta>
) => void;

export type AtomOptions = { name?: string };

export type Model<TContext = {}, TMeta = {}> = {
  readonly id: Symbol;
  readonly meta: TMeta;
  readonly effects: Effect<TContext, TMeta>[];

  use<TOtherMeta>(meta: TOtherMeta): Model<TContext, TMeta & TOtherMeta>;

  query<TName extends string, TData, TVariables>(
    name: TName,
    document: TypedQueryDocumentNode<TData, TVariables>
  ): Model<TContext, AddProp<TMeta, TName, Query<TVariables, TData>>>;

  query<TName extends string>(
    name: TName,
    document: DocumentNode
  ): Model<TContext, AddProp<TMeta, TName, Query<any, any>>>;

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

  state<TName extends string, TData>(
    name: TName,
    data: TData | ((context: StateContext<TContext, TMeta>) => TData),
    options?: AtomOptions
  ): Model<TContext, AddProp<TMeta, TName, State<TData>>>;

  type<
    TType extends string,
    TResolvers extends Record<
      string,
      | FieldResolver<FieldContext<TContext, TMeta>, any, any, any>
      | [string, FieldResolver<FieldContext<TContext, TMeta>, any, any, any>]
    >
  >(
    type: TType,
    resolvers: TResolvers
  ): Model<TContext, AddProp<TMeta, TType, TResolvers>>;

  effect(...fn: Effect<TContext, TMeta>[]): Model<TContext, TMeta>;

  init(client: Client): void;

  call<TResult, TArgs extends any[]>(
    client: Client,
    action: (
      context: MutationContext<TContext, TMeta>,
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

export type SkipFirst<T> = T extends [infer _, ...infer TRest] ? TRest : T;

export type SkipFirstArg<T extends (...args: any) => any> = (
  ...args: SkipFirst<Parameters<T>>
) => ReturnType<T>;

export type CallbackGroup = {
  /**
   * add callback into the group and return `remove` function
   * @param callback
   */
  (callback: Function): VoidFunction;
  called(): number;
  /**
   * call all callbacks with specified args
   * @param args
   */
  invoke(...args: any[]): void;
  /**
   * remove all callbacks
   */
  clear(): void;
  size(): number;
  clone(): CallbackGroup;
  invokeAndClear(...args: any[]): void;
};

export type SessionManager = {
  readonly key: any;
  /**
   * this uses for query session only
   */
  readonly observableQuery: ObservableQuery;
  readonly data: any;
  start(): Session;
  onLoad: CallbackGroup;
  onDispose: CallbackGroup;
  evict(): void;
  refetch(): Promise<ApolloQueryResult<any>>;
};

export type Session = {
  readonly isActive: boolean;
  readonly manager: SessionManager;
};

export type FieldMappings = Record<
  string,
  Record<string, { field: string; type?: string }>
>;

export type QueryInfo = {
  query: Query;
  observable: ObservableQuery;
};

export type Lazy<T = any> = {
  readonly type: "lazy";
  readonly options: LazyOptions;
  data: () => T | Promise<T>;
  loader(): T | Promise<T>;
};

export type LazyFactory = {
  <T>(loader: Lazy<T>["loader"], options?: LazyOptions): Lazy<T>;
  <T>(data: T, loader: Lazy<T>["loader"], options?: LazyOptions): Lazy<T>;
};

export type LazyOptions = { interval?: number };
