import type { SourceKind } from "@ngriffin_uk/polychat-schemas";
import { isBoilerplate, markdownToPlainText } from "@ngriffin_uk/polychat-utility-core";

export const LISTEN_PASSAGE_CHARACTERS = 1_200;

const SHORT_LINE_CHARACTERS = 80;
const NARRATED_KINDS: ReadonlySet<SourceKind> = new Set(["text", "url", "file", "connector"]);

export function canListenToSource(source: {
  kind: SourceKind;
  content: string | null;
  mimeType: string | null;
}): boolean {
  return (
    NARRATED_KINDS.has(source.kind) &&
    Boolean(source.content?.trim()) &&
    !source.mimeType?.startsWith("audio/") &&
    !source.mimeType?.startsWith("video/")
  );
}

export function buildListenPassages(content: string): string[] {
  const paragraphs = markdownToPlainText(content)
    .split(/\n+/u)
    .map((paragraph) => paragraph.replace(/\s+/gu, " ").trim())
    .filter(
      (paragraph) =>
        paragraph.length > 0 &&
        !(paragraph.length < SHORT_LINE_CHARACTERS && isBoilerplate(paragraph)),
    );
  const passages: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 1 > LISTEN_PASSAGE_CHARACTERS) {
      passages.push(current);
      current = "";
    }

    current = current ? `${current}\n${paragraph}` : paragraph;
  }

  if (current) {
    passages.push(current);
  }

  return passages;
}
