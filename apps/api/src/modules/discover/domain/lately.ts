import type { PolyLatelyInput } from "@ngriffin_uk/polychat-ai-prompts";

import type { DiscoverSignalDocument } from "~/modules/discover/application/notebook";

import { isDiscoverSignalCurrent } from "./freshness";

const SOURCE_LIMIT = 10;
const LINES_PER_SOURCE = 4;

export function describeLately(
  documents: readonly Pick<DiscoverSignalDocument, "title" | "lines" | "readAt" | "error">[],
  now = Date.now(),
): PolyLatelyInput[] {
  return documents
    .filter(
      (document) =>
        !document.error &&
        isDiscoverSignalCurrent(document.readAt, now) &&
        document.lines.length > 0,
    )
    .slice(0, SOURCE_LIMIT)
    .map((document) => ({
      title: document.title,
      lines: document.lines.slice(0, LINES_PER_SOURCE),
    }));
}
