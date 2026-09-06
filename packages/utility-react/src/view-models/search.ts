export type SearchResultKind = "conversation" | "project" | "workspace" | "capability";

export interface SearchResult {
  id: string;
  kind: SearchResultKind;
  title: string;
  description: string;
  href: string;
}
