import {
  NOTEBOOK_SOURCE_CITATION_PREFIX,
  type CreateNotebookNoteInput,
  type NotebookDetail,
} from "@ngriffin_uk/polychat-schemas";
import { splitTitleAndContent, truncateSingleLine } from "@ngriffin_uk/polychat-utility-core";

export function hasPendingNotebookWork(notebook: NotebookDetail): boolean {
  return (
    notebook.guideStatus === "writing" ||
    notebook.outputs.some((output) => output.status === "pending") ||
    [...notebook.sources, ...notebook.media].some((source) => source.status === "processing")
  );
}

export function readSourceCitationId(href: string | null | undefined): string | null {
  if (!href?.startsWith(NOTEBOOK_SOURCE_CITATION_PREFIX)) {
    return null;
  }

  const sourceId = decodeURIComponent(href.slice(NOTEBOOK_SOURCE_CITATION_PREFIX.length));

  return sourceId || null;
}

const NOTE_TITLE_LENGTH = 80;
const MARKDOWN_LINE_MARKERS = /^\s*(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)/;
const MARKDOWN_INLINE_MARKERS = /(\*\*|__|`)/g;

export function noteFromReply(content: string): CreateNotebookNoteInput {
  const firstLine = splitTitleAndContent(content.trim())[0]
    .replace(MARKDOWN_LINE_MARKERS, "")
    .replaceAll(MARKDOWN_INLINE_MARKERS, "");

  return {
    title: truncateSingleLine(firstLine, NOTE_TITLE_LENGTH) || "Saved reply",
    content: content.trim(),
  };
}
