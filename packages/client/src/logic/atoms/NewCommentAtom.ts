import { AddCommentInput } from "static/graphql/types";
import { atom } from "axtore";

const NewCommentAtom = atom<AddCommentInput | undefined>(undefined);

export { NewCommentAtom };
