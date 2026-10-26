import {
  KNOWLEDGE_ORIGIN_METADATA_KEY,
  type Source,
  type SourceSummary,
} from "@ngriffin_uk/polychat-schemas";
import { splitTitleAndContent } from "@ngriffin_uk/polychat-utility-core";

export const NEW_NOTE_TITLE = "Untitled note";

const TITLE_CHARACTERS = 200;

export function isNote(source: Pick<SourceSummary, "kind" | "metadata">): boolean {
  return source.kind === "text" && source.metadata[KNOWLEDGE_ORIGIN_METADATA_KEY] === "note";
}

export function canEditNoteText(source: Pick<Source, "kind" | "metadata">): boolean {
  return (
    source.kind === "text" &&
    source.metadata.immutableSnapshot !== true &&
    typeof source.metadata.syncId !== "string"
  );
}

export function isBlankNewNote(source: Pick<Source, "title" | "content" | "revision">): boolean {
  return source.title === NEW_NOTE_TITLE && !source.content?.trim() && source.revision === 1;
}

export function noteEditorText(source: Pick<Source, "title" | "content" | "revision">): string {
  if (isBlankNewNote(source)) {
    return "";
  }

  return source.content ? `${source.title}\n${source.content}` : source.title;
}

export function splitNoteText(text: string): { title: string; content: string } {
  const [firstLine, rest] = splitTitleAndContent(text);
  const title = firstLine.trim().slice(0, TITLE_CHARACTERS);

  return { title: title || NEW_NOTE_TITLE, content: rest };
}
