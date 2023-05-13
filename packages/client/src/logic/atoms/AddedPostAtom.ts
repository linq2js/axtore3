import { Post } from "static/graphql/types";
import { atom } from "axtore";

const AddedPostAtom = atom<Post | undefined>(undefined);

export { AddedPostAtom };
