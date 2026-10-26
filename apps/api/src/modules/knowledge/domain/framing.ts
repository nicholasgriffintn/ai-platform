import { ARTICLE_SLANT_LABELS, type ArticleFramingDraft } from "@ngriffin_uk/polychat-schemas";

export function renderArticleFraming(framing: ArticleFramingDraft): string {
  const sections = [
    `## Overview\n\n${framing.overview}`,
    `**Slant:** ${ARTICLE_SLANT_LABELS[framing.slant]} · **Tone:** ${framing.tone}`,
    `## Sourcing\n\n${framing.sourcing}`,
  ];

  if (framing.loadedLanguage.length > 0) {
    sections.push(
      `## Loaded language\n\n${framing.loadedLanguage
        .map((item) => `- "${item.quote}": ${item.note}`)
        .join("\n")}`,
    );
  }

  if (framing.missingPerspectives.length > 0) {
    sections.push(
      `## Missing perspectives\n\n${framing.missingPerspectives
        .map((perspective) => `- ${perspective}`)
        .join("\n")}`,
    );
  }

  return sections.join("\n\n");
}
