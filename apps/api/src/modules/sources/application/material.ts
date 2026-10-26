import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import { readSourceSummary, renderSourceSummary } from "~/modules/sources/domain/summary";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";

export const SOURCE_MATERIAL_MAX_CHARACTERS = 80_000;

export type MaterialSource = Pick<SourceRecord, "title" | "content" | "external_uri"> &
  Partial<Pick<SourceRecord, "metadata">>;

function chooseMaterialText(
  entries: readonly { body: string; brief: string }[],
  maxCharacters: number,
): string[] {
  if (entries.reduce((total, entry) => total + entry.body.length, 0) <= maxCharacters) {
    return entries.map((entry) => entry.body);
  }

  let spare = maxCharacters - entries.reduce((total, entry) => total + entry.brief.length, 0);

  return entries.map((entry) => {
    const extra = entry.body.length - entry.brief.length;

    if (extra > 0 && extra <= spare) {
      spare -= extra;

      return entry.body;
    }

    return entry.brief;
  });
}

export function buildSourceMaterial(
  sources: readonly MaterialSource[],
  maxCharacters = SOURCE_MATERIAL_MAX_CHARACTERS,
): string {
  const entries = sources.flatMap((source) => {
    const body = (source.content ?? source.external_uri ?? "").trim();
    const summary = readSourceSummary(parseJsonRecord(source.metadata));
    const rendered = summary ? renderSourceSummary(summary) : body;

    return body
      ? [{ title: source.title, body, brief: rendered.length < body.length ? rendered : body }]
      : [];
  });
  const texts = chooseMaterialText(entries, maxCharacters);
  let remaining = maxCharacters;
  const sections: string[] = [];

  for (const [index, entry] of entries.entries()) {
    const text = texts[index] ?? "";

    if (remaining <= 0) {
      break;
    }

    const excerpt = text.slice(0, remaining);

    remaining -= excerpt.length;
    sections.push(`## ${entry.title}\n\n${excerpt}`);
  }

  return sections.join("\n\n");
}
