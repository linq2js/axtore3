import {
  AddDocument,
  AddMutationResult,
  AddMutationVariables,
} from "static/graphql/types";

import { AddedCommentAtom } from "logic/atoms/AddedCommentAtom";
import { AddedPostAtom } from "logic/atoms/AddedPostAtom";
import { NewCommentAtom } from "logic/atoms/NewCommentAtom";
import { NewPostAtom } from "logic/atoms/NewPostAtom";
import { mutation } from "axtore";

const AddMutation = mutation<AddMutationVariables, AddMutationResult>(
  AddDocument
).wrap("add", {
  prepare(args, { set }) {
    // do optimistic update
    if (args.post) {
      set(NewPostAtom, { data: args.post });
    }

    if (args.comment) {
      set(NewCommentAtom, { data: args.comment });
    }
  },
  map(result, { set }) {
    if (result.add.post) {
      set(AddedPostAtom, { data: result.add.post });
    }

    if (result.add.comment) {
      set(AddedCommentAtom, { data: result.add.comment });
    }
  },
});

export { AddMutation };
