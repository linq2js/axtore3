import {
  LatestPostListDocument,
  LatestPostListQueryResult,
  LatestPostListQueryVariables,
} from "static/graphql/types";
import { changed, query } from "axtore";

import { AddedPostAtom } from "logic/atoms/AddedPostAtom";

const LatestPostListQuery = query<
  LatestPostListQueryVariables | undefined,
  LatestPostListQueryResult
>(LatestPostListDocument, { refetch: { when: changed(AddedPostAtom) } });

export { LatestPostListQuery };
