import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";

export const SOURCE_MATERIAL_MAX_CHARACTERS = 80_000;

export function buildSourceMaterial(
  sources: readonly Pick<SourceRecord, "title" | "content" | "external_uri">[],
  maxCharacters = SOURCE_MATERIAL_MAX_CHARACTERS,
): string {
  let remaining = maxCharacters;
  const sections: string[] = [];

  for (const source of sources) {
    const body = (source.content ?? source.external_uri ?? "").trim();

    if (!body || remaining <= 0) {
      continue;
    }

    const excerpt = body.slice(0, remaining);

    remaining -= excerpt.length;
    sections.push(`## ${source.title}\n\n${excerpt}`);
  }

  return sections.join("\n\n");
}
