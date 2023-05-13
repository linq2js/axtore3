import { AddPostInput } from "static/graphql/types";
import { atom } from "axtore";

const NewPostAtom = atom<AddPostInput | undefined>(undefined);

export { NewPostAtom };
