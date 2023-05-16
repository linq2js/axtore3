export type SearchTerm = {
  userId?: number;
  searchIn: "title" | "body";
  text: string;
};
