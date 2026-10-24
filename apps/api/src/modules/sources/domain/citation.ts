import { NOTEBOOK_SOURCE_CITATION_PREFIX } from "@ngriffin_uk/polychat-schemas";

export function formatSourceCitation(source: { id: string; title: string }): string {
  return `[${source.title.replaceAll(/[[\]]/g, "")}](${NOTEBOOK_SOURCE_CITATION_PREFIX}${encodeURIComponent(source.id)})`;
}
