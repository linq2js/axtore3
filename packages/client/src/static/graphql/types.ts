/* eslint-disable */
/* This file is generated. Do not modify directly. */
import gql from 'graphql-tag';
export type Maybe<T> = T | undefined;
export type InputMaybe<T> = T | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };

      export interface PossibleTypesResultData {
        possibleTypes: {
          [key: string]: string[]
        }
      }
      const result: PossibleTypesResultData = {
  "possibleTypes": {}
};
      export default result;
    
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  Void: any;
};

export type AddCommentInput = {
  body: Scalars['String'];
  email: Scalars['String'];
  id: Scalars['Int'];
  name: Scalars['String'];
  postId: Scalars['Int'];
};

export type AddPostInput = {
  body: Scalars['String'];
  id: Scalars['Int'];
  title: Scalars['String'];
};

export type AddResult = {
  __typename?: 'AddResult';
  comment?: Maybe<Comment>;
  post?: Maybe<Post>;
};

export type Comment = {
  __typename?: 'Comment';
  body: Scalars['String'];
  createdOn: Scalars['Float'];
  email: Scalars['String'];
  id: Scalars['Int'];
  name: Scalars['String'];
  postId: Scalars['Int'];
};

export type Mutation = {
  __typename?: 'Mutation';
  add: AddResult;
  remove?: Maybe<Scalars['Void']>;
};


export type MutationAddArgs = {
  comment?: InputMaybe<AddCommentInput>;
  post?: InputMaybe<AddPostInput>;
};


export type MutationRemoveArgs = {
  commentId?: InputMaybe<Scalars['Int']>;
  postId?: InputMaybe<Scalars['Int']>;
};

export type Post = {
  __typename?: 'Post';
  body: Scalars['String'];
  createdOn: Scalars['Float'];
  id: Scalars['Int'];
  title: Scalars['String'];
  userId: Scalars['Int'];
};

export type Query = {
  __typename?: 'Query';
  comments: Array<Comment>;
  latestComments: Array<Comment>;
  latestPosts: Array<Post>;
  posts: Array<Post>;
  profile: User;
};


export type QueryCommentsArgs = {
  postId?: InputMaybe<Scalars['Int']>;
};


export type QueryLatestCommentsArgs = {
  limit?: InputMaybe<Scalars['Int']>;
};


export type QueryLatestPostsArgs = {
  limit?: InputMaybe<Scalars['Int']>;
};

export type User = {
  __typename?: 'User';
  email: Scalars['String'];
  id: Scalars['Int'];
  name: Scalars['String'];
};

export type AddMutationVariables = Exact<{
  comment?: InputMaybe<AddCommentInput>;
  post?: InputMaybe<AddPostInput>;
}>;


export type AddMutationResult = { __typename?: 'Mutation', add: { __typename?: 'AddResult', post?: { __typename?: 'Post', id: number, title: string, body: string, userId: number, createdOn: number } | undefined, comment?: { __typename?: 'Comment', id: number, name: string, email: string, body: string, postId: number, createdOn: number } | undefined } };

export type LatestPostListQueryVariables = Exact<{
  limit?: InputMaybe<Scalars['Int']>;
}>;


export type LatestPostListQueryResult = { __typename?: 'Query', latestPosts: Array<{ __typename?: 'Post', id: number, title: string, body: string, userId: number, createdOn: number }> };

export type ProfileQueryVariables = Exact<{ [key: string]: never; }>;


export type ProfileQueryResult = { __typename?: 'Query', profile: { __typename?: 'User', id: number, name: string, email: string } };

export type UserPostListQueryVariables = Exact<{ [key: string]: never; }>;


export type UserPostListQueryResult = { __typename?: 'Query', posts: Array<{ __typename?: 'Post', id: number, title: string, body: string, userId: number, createdOn: number }> };


export const AddDocument = gql`
    mutation Add($comment: AddCommentInput, $post: AddPostInput) {
  add(comment: $comment, post: $post) {
    post {
      id
      title
      body
      userId
      createdOn
    }
    comment {
      id
      name
      email
      body
      postId
      createdOn
    }
  }
}
    `;
export const LatestPostListDocument = gql`
    query LatestPostList($limit: Int) {
  latestPosts(limit: $limit) {
    id
    title
    body
    userId
    createdOn
  }
}
    `;
export const ProfileDocument = gql`
    query Profile {
  profile {
    id
    name
    email
  }
}
    `;
export const UserPostListDocument = gql`
    query UserPostList {
  posts {
    id
    title
    body
    userId
    createdOn
  }
}
    `;