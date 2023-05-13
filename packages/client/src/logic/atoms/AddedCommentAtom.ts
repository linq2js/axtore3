import { Comment } from "static/graphql/types";
import { atom } from "axtore";

const AddedCommentAtom = atom<Comment | undefined>(undefined);

export { AddedCommentAtom };
