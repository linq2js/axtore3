import {
  Comment,
  MutationAddArgs,
  MutationRemoveArgs,
  Post,
  QueryLatestCommentsArgs,
  QueryLatestPostsArgs,
  User,
} from "./static/graphql/types";

import { createCollection } from "./createCollection";

type ResolverOptions = {
  delay?: number;
};

type ResolverBuilder = {
  <T>(
    fn: (args: any, context: { user: User }, self: any) => T,
    options: ResolverOptions & { auth: true }
  ): Function;
  <T>(
    fn: (args: any, context: { user?: User }, self: any) => T,
    options?: ResolverOptions
  ): Function;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createdOnDesc = <T extends { createdOn: number }>(a: T, b: T) =>
  b.createdOn - a.createdOn;

const resolver: ResolverBuilder = (
  fn: Function,
  options?: ResolverOptions & { auth?: boolean }
) => {
  const { delay: delayMs = 1500, auth } = options ?? {};
  return async (self: any, args: any, context: any) => {
    let user: User | undefined;

    if (context.userId) {
      user = await users.use((items) =>
        items.find((x) => x.id === context.userId)
      );
    }

    if (!user && auth) {
      throw new Error(`Access denied ${auth}`);
    }

    const result = await fn(args, { ...context, user }, self);

    if (delayMs) {
      await delay(delayMs);
    }

    return result;
  };
};

const users = createCollection<User>(
  "User",
  "https://jsonplaceholder.typicode.com/users"
);

const posts = createCollection<Post>(
  "Post",
  "https://jsonplaceholder.typicode.com/posts",
  undefined,
  (item) => {
    if (!item.createdOn) {
      item.createdOn = Date.now();
    }
  }
);

const comments = createCollection<Comment>(
  "Comment",
  "https://jsonplaceholder.typicode.com/comments",
  undefined,
  (item) => {
    if (!item.createdOn) {
      item.createdOn = Date.now();
    }
  }
);

const resolvers = {
  Query: {
    profile: resolver((_, { user }) => user, { auth: true }),

    posts: resolver(
      (_, { user }) => {
        return posts.use((list) => list.filter((x) => x.userId === user?.id));
      },
      { auth: true }
    ),

    comments: resolver(
      (_, { user }) => {
        return comments.use((list) =>
          list.filter((x) => x.email === user?.email)
        );
      },
      { auth: true }
    ),

    latestPosts: resolver((args: QueryLatestPostsArgs) => {
      const { limit = 5 } = args;
      return posts.use((list) => list.sort(createdOnDesc).slice(0, limit));
    }),

    latestComments: resolver((args: QueryLatestCommentsArgs) => {
      const { limit = 5 } = args;
      return comments.use((list) => list.sort(createdOnDesc).slice(0, limit));
    }),
  },

  Mutation: {
    add: resolver(
      async (args: MutationAddArgs, { user }) => {
        const { comment, post } = args;
        if (comment) {
          return {
            comment: await comments.use((list) => {
              if (list.find((x) => x.id === comment.id)) return;
              const newComment = { ...comment, createdOn: Date.now() };
              list.push(newComment);
              return newComment;
            }),
          };
        }

        if (post) {
          return {
            post: await posts.use((list) => {
              if (list.find((x) => x.id === post.id)) return;
              const newPost = {
                ...post,
                userId: user.id,
                createdOn: Date.now(),
              };
              list.push(newPost);
              return newPost;
            }),
          };
        }

        return {};
      },
      { auth: true }
    ),

    remove: resolver(
      async (args: MutationRemoveArgs, { user }) => {
        const { commentId, postId } = args;
        if (commentId) {
          await comments.use((list) => {
            const existing = list.find((x) => x.id === commentId);
            if (!existing) {
              throw new Error("Comment not found");
            }
            // should not allow user removes another user's comment
            if (existing.email !== user.email) {
              throw new Error("Invalid Operation");
            }
          });
        }

        if (postId) {
          await posts.use((list) => {
            const existing = list.find((x) => x.id === postId);
            if (!existing) {
              throw new Error("Comment not found");
            }
            // should not allow user removes another user's post
            if (existing.userId !== user.id) {
              throw new Error("Invalid Operation");
            }
          });
        }
      },
      { auth: true }
    ),
  },
};

export { resolvers };
