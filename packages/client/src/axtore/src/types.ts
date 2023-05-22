import { DocumentNode, TypedQueryDocumentNode } from "graphql";

import { ApolloClient, ApolloError, ObservableQuery } from "@apollo/client";

export type ObjectType =
  | "state"
  | "query"
  | "mutation"
  | "lazy"
  | "loadable"
  | "model"
  | "event";

export type ApolloContext = { client: Client };

export type NoInfer<T> = [T][T extends any ? 0 : never];

export type Client<TCacheShape = any> = ApolloClient<TCacheShape>;

export type Event<TArgs = any> = {
  readonly type: "event";
  readonly name: string;
  readonly model: Model<any, any>;
};

export type EventDispatcher<TArgs> = {
  (): Promise<TArgs>;
  last(): TArgs | undefined;
  any(): Promise<TArgs>;
  fire(args: TArgs): Promise<void>;
  fireOnce(args: TArgs): Promise<void>;
  pause(): void;
  resume(): void;
  paused(): boolean;
  /**
   * listen the event multiple times
   * @param listener
   */
  on(listener: (args: TArgs) => void): VoidFunction;
};

export type Query<TVariables = any, TData = any> = {
  readonly type: "query";
  readonly name: string;
  readonly document: DocumentNode;
  readonly resolver?: RootResolver<any, TVariables, TData>;
  readonly model: Model<any, any>;
  readonly options: QueryOptions<TVariables>;
  mergeOptions(options?: any): any;
};

export type OperationEvents<TVariables, TData> = {
  onCompleted?(data: TData, variables: TVariables): void;
  onError?(error: ApolloError, variables: TVariables): void;
};

export type Mutation<TVariables = any, TData = any> = {
  readonly type: "mutation";
  readonly name: string;
  readonly document: DocumentNode;
  readonly resolver?: RootResolver<any, TVariables, TData>;
  readonly model: Model<any, any>;
  readonly options: MutationOptions<TVariables>;
  mergeOptions(options?: any): any;
};

export type TypeResolverSet<TResolvers = any> = {
  readonly type: "type";
  readonly resolvers: TResolvers;
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

export type Listenable<T = void> = (
  listener: (args: T) => void
) => VoidFunction;

export type ExtrasContext = ContextBase;

export type ContextBase = {
  /**
   * original context
   */
  readonly context: any;

  /**
   * Apollo client
   */
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
  /**
   * call the extras and forward all args to it
   * @param extras
   * @param args
   */
  use<TResult, TArgs extends any[]>(
    extras: Extras<TResult, TArgs>,
    ...args: TArgs
  ): TResult;

  set<T>(target: T | T[]): void;
  set<T>(
    target: T | T[],
    fields: { [key in keyof T]?: T[key] | UpdateRecipe<T[key]> }
  ): void;

  all<TTargets extends (Promise<any> | ((onCancel: Listenable) => any))[]>(
    ...targets: TTargets
  ): CancellablePromise<{
    [key in keyof TTargets]: TTargets[key] extends Promise<infer T>
      ? T
      : TTargets[key] extends (
          onCancel: Listenable
        ) => Promise<infer T> | infer T
      ? T
      : never;
  }>;

  race<TTargets extends (Promise<any> | ((onCancel: Listenable) => any))[]>(
    ...targets: TTargets
  ): CancellablePromise<
    InferArrayType<{
      [key in keyof TTargets]: TTargets[key] extends Promise<infer T>
        ? T
        : TTargets[key] extends (
            onCancel: Listenable
          ) => Promise<infer T> | infer T
        ? T
        : never;
    }>
  >;
};

export type InferArrayType<T> = T extends Array<infer I> ? I : any;

export type CancellablePromise<T> = Promise<T> & { cancel(): void };

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

export type FieldOptions = {
  type?: string;
  parse?(raw: Record<string, any>): any;
};

export type FieldResolver<
  TContext,
  TValue = any,
  TArgs = any,
  TResult = any
> = (
  context: ApolloContext & TContext,
  args: TArgs,
  value: TValue
) => TResult | Promise<TResult> | Lazy<TResult>;

export type RootResolver<TContext, TArgs = any, TResult = any> = (
  context: TContext & ApolloContext,
  args: TArgs
) => TResult | Promise<TResult> | Lazy<TResult>;

export type ConcurrencyOptions = { debounce?: number; throttle?: number };

export type QueryOptions<TVariables = any> = {
  /**
   * specify type name of dynamic query's returned value
   */
  type?: string;
  /**
   * the query will do evict its data whenever its dependencies changed
   * this makes the observable query / query hook do refetching immediately
   * by default, the query does soft refetch and the refetching process runs in background, no loading status changed
   */
  hardRefetch?: boolean;
  /**
   * by default, query has reactive mode, when query's dependencies updated the query does refetching as well. if proactive = true, the query does nothing
   */
  proactive?: boolean;
  stateTime?: number;

  parse?(raw: Record<string, any>): TVariables;
} & ConcurrencyOptions;

export type MutationOptions<TVariables = any> = {
  /**
   * specify type name of dynamic mutation's returned value
   */
  type?: string;

  parse?(raw: Record<string, any>): TVariables;
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

export type NormalizeProps<TObject> = {
  [key in keyof TObject as TObject[key] extends never
    ? never
    : key]: TObject[key];
};

export type RemovePrivateProps<TObject, TPrivatePrefix extends string = "_"> = {
  [key in keyof TObject as key extends `${TPrivatePrefix}${string}`
    ? never
    : key]: TObject[key];
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
         * @param dataOrRecipe if argument is function, we use immer to mutate query data with that recipe function, otherwise we set the query to new one.
         * In case of using update recipe, nothing to update if the query data has not been fetched yet
         * @param args
         * ```js
         * // let say we have the query `myQuery`  returns the data `{ total: number, items: Todo[] }`
         * // we must provide whole data object when updating the query
         * $myQuery.set({  total: 100, items: [{id: 1}, {id: 2}] })
         * // or we use update recipe to modify partial query data
         * $myQuery.set(draft => {
         *  draft.total = 100;
         * })
         * ```
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
  : T extends (...args: any[]) => any
  ? ReturnType<T>
  : TScopes extends { async: true }
  ? T extends Query<infer TVariables, infer TData>
    ? QueryDispatcher<TScopes, TVariables, TData>
    : T extends Mutation<infer TVariables, infer TData>
    ? MutationDispatcher<TVariables, TData>
    : T extends Event<infer TArgs>
    ? EventDispatcher<TArgs>
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
  options: StateOptions<TData>;
  initial: TData | ((context: any) => TData);
};

export type Effect<TContext = {}, TMeta = {}> = (
  context: MutationContext<TContext, TMeta>
) => void;

export type StateOptions<TState> = {
  name?: string;
  parse?(raw: any): TState;
  equal?(a: TState, b: TState): boolean;
};

export type Field = FieldResolver<any, any, any, any> & {
  model: Model<any, any>;
  options: FieldOptions;
};

export type CustomDispatcher<TArgs extends any[] = any[], TResult = any> = (
  context: ContextBase
) => (...args: TArgs) => TResult;

export type MetaBase = {
  [key: string]:
    | State
    | Query
    | Mutation
    | CustomDispatcher
    | Record<string, Function>;
};

export type Model<TContext = {}, TMeta extends MetaBase = {}> = {
  readonly __type: "model";
  readonly id: Symbol;
  readonly meta: TMeta;
  readonly effects: Effect<TContext, TMeta>[];

  use<TOtherMeta extends MetaBase>(
    meta: TOtherMeta
  ): Model<TContext, TMeta & TOtherMeta>;

  query<TName extends string, TData, TVariables>(
    name: TName,
    document: TypedQueryDocumentNode<TData, TVariables>
  ): Model<TContext, AddProp<TMeta, TName, Query<TVariables, TData>>>;

  query<TName extends string>(
    name: TName,
    document: DocumentNode
  ): Model<TContext, AddProp<TMeta, TName, Query<any, any>>>;

  /**
   * create query with alias
   * @param name
   * @param resolver
   * @param options
   */
  query<TAlias extends string, TName extends string, TVariables, TData>(
    name: `${TAlias}:${TName}`,
    resolver: RootResolver<QueryContext<TContext, TMeta>, TVariables, TData>,
    options?: NoInfer<QueryOptions<TVariables>>
  ): Model<
    TContext,
    AddProp<TMeta, TAlias, Query<TVariables, { [key in TAlias]: TData }>>
  >;

  event<TName extends string, TArgs = void>(
    name: TName
  ): Model<TContext, AddProp<TMeta, TName, Event<TArgs>>>;

  event<TName extends string, TArgs = void>(
    name: TName,
    args: () => { __type__: TArgs }
  ): Model<TContext, AddProp<TMeta, TName, Event<TArgs>>>;

  query<TName extends string, TVariables = void, TData = any>(
    name: TName,
    resolver: RootResolver<QueryContext<TContext, TMeta>, TVariables, TData>,
    options?: NoInfer<QueryOptions<TVariables>>
  ): Model<
    TContext,
    AddProp<TMeta, TName, Query<TVariables, { [key in TName]: TData }>>
  >;

  mutation<TName extends string, TVariables = any, TData = void>(
    name: TName,
    document: TypedQueryDocumentNode<TData, TVariables>
  ): Model<TContext, AddProp<TMeta, TName, Mutation<TVariables, TData>>>;

  mutation<TName extends string, TVariables = any, TData = void>(
    name: TName,
    resolver: RootResolver<MutationContext<TContext, TMeta>, TVariables, TData>,
    options?: NoInfer<MutationOptions<TVariables>>
  ): Model<
    TContext,
    AddProp<TMeta, TName, Mutation<TVariables, { [key in TName]: TData }>>
  >;

  /**
   * create mutation with alias
   * @param name
   * @param resolver
   * @param options
   */
  mutation<TAlias extends string, TName extends string, TVariables, TData>(
    name: `${TAlias}:${TName}`,
    resolver: RootResolver<MutationContext<TContext, TMeta>, TVariables, TData>,
    options?: NoInfer<MutationOptions<TVariables>>
  ): Model<
    TContext,
    AddProp<TMeta, TAlias, Mutation<TVariables, { [key in TAlias]: TData }>>
  >;

  state<TName extends string, TState>(
    name: TName,
    data: TState | ((context: StateContext<TContext, TMeta>) => TState),
    options?: NoInfer<StateOptions<TState>>
  ): Model<TContext, AddProp<TMeta, TName, State<TState>>>;

  type<
    TType extends string,
    TResolvers extends Record<
      string,
      | FieldResolver<FieldContext<TContext, TMeta>, any, any, any>
      | [string, FieldResolver<FieldContext<TContext, TMeta>, any, any, any>]
      | [
          FieldOptions,
          FieldResolver<FieldContext<TContext, TMeta>, any, any, any>
        ]
    >
  >(
    type: TType,
    resolvers: TResolvers
  ): Model<TContext, AddProp<TMeta, TType, TResolvers>>;

  effect(...fn: Effect<TContext, TMeta>[]): Model<TContext, TMeta>;

  init(client: Client): void;

  call<TResult, TArgs extends any[]>(
    client: Client,
    action: ModelAction<TContext, TMeta, TArgs, TResult>,
    ...args: TArgs
  ): TResult;
};

export type ModelAction<TContext, TMeta, TArgs extends any[], TResult> = (
  context: MutationContext<TContext, TMeta>,
  ...args: TArgs
) => TResult;

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

export type CallbackGroup<T = void> = {
  /**
   * add callback into the group and return `remove` function
   * @param callback
   */
  (callback: (args: T) => void, once?: boolean): VoidFunction;
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
  clone(): CallbackGroup<T>;
  invokeAndClear(...args: any[]): void;
};

export type EnhancedObservableQuery = ObservableQuery & {
  readonly onChange: CallbackGroup;
  readonly onNext: CallbackGroup;
};

export type SessionManager = {
  readonly key: any;
  /**
   * this uses for query session only
   */
  readonly observableQuery: EnhancedObservableQuery;
  data: any;
  start(): Session;
  dispose(): void;
  onLoad: CallbackGroup;
  onDispose: CallbackGroup;
  query?: Query;
  mutation?: Mutation;
  invalidate?: VoidFunction;
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
