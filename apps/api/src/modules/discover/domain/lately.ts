import type { PolyLatelyInput } from "@ngriffin_uk/polychat-ai-prompts";

import type { DiscoverSignalDocument } from "~/modules/discover/application/notebook";

const SOURCE_LIMIT = 10;
const LINES_PER_SOURCE = 4;

export function describeLately(
  documents: readonly Pick<DiscoverSignalDocument, "title" | "lines" | "readAt" | "error">[],
): PolyLatelyInput[] {
  return documents
    .filter((document) => !document.error && document.readAt && document.lines.length > 0)
    .slice(0, SOURCE_LIMIT)
    .map((document) => ({
      title: document.title,
      lines: document.lines.slice(0, LINES_PER_SOURCE),
    }));
}
