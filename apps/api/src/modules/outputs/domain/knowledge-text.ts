import {
  DECK_OUTPUT_KIND,
  SHEET_OUTPUT_KIND,
  deckOutputContentSchema,
  documentOutputContentSchema,
  sheetOutputContentSchema,
} from "@ngriffin_uk/polychat-schemas";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-core";

export function outputKnowledgeText(kind: string, title: string, content: string | null): string {
  const parsed = safeParseJson(content);

  if (kind === "document") {
    const document = documentOutputContentSchema.safeParse(parsed);

    return document.success ? `# ${title}\n\n${document.data.body}` : "";
  }

  if (kind === DECK_OUTPUT_KIND) {
    const deck = deckOutputContentSchema.safeParse(parsed);

    return deck.success
      ? [
          `# ${title}`,
          ...deck.data.slides.map((slide) =>
            [
              `## ${slide.title}`,
              slide.subtitle,
              ...slide.bullets.map((bullet) => `- ${bullet}`),
              slide.body,
              ...(slide.columns ?? []),
            ]
              .filter(Boolean)
              .join("\n"),
          ),
        ].join("\n\n")
      : "";
  }

  if (kind === SHEET_OUTPUT_KIND) {
    const sheet = sheetOutputContentSchema.safeParse(parsed);

    return sheet.success
      ? [
          `# ${title}`,
          ...sheet.data.tables.map((table) =>
            [
              `## ${table.name}`,
              table.columns.map((column) => column.label).join(" | "),
              ...table.rows.map((row) =>
                table.columns.map((column) => String(row[column.key] ?? "")).join(" | "),
              ),
            ].join("\n"),
          ),
        ].join("\n\n")
      : "";
  }

  return "";
}
