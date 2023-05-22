import { ApolloClient, InMemoryCache } from "@apollo/client";
import { useState } from "react";
import { Client, RemovePrivateProps } from "../types";
import { InferHooks, createHooks } from "./createHooks";

export type CreateUseModelOptions = {
  createClient?: () => Client;
};

export type CreateUseModel = {
  <TMeta>(meta: TMeta, options?: CreateUseModelOptions): (
    client?: Client
  ) => InferHooks<RemovePrivateProps<TMeta>>;
  <TMeta, TPrefix extends string>(
    meta: TMeta,
    options: CreateUseModelOptions & { prefix: TPrefix }
  ): (client?: Client) => InferHooks<RemovePrivateProps<TMeta>, TPrefix>;
};

const defaultClientCreator = () =>
  new ApolloClient({ cache: new InMemoryCache() });

const createUseModel: CreateUseModel = (
  meta: any,
  {
    createClient = defaultClientCreator,
    ...options
  }: CreateUseModelOptions & { prefix?: string } = {}
) => {
  return () => {
    return useState((override?: Client) =>
      createHooks(meta, { ...options, client: override ?? createClient() })
    )[0];
  };
};

export { createUseModel };
