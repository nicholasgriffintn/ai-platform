import type { DiscoverEditionContent } from "@ngriffin_uk/polychat-schemas";

import type { DiscoverFeedbackEntry } from "./feedback";

const DAY_MS = 24 * 60 * 60 * 1000;

export const DISCOVER_LISTEN_SHOW = "The Perch";

export const DISCOVER_LISTEN_FOCUS =
  "A warm, unhurried morning round-up for one listener. Open with the brief, spend most of the time on the two or three most interesting topics, mention the reading worth saving, and close by reminding them what is worth doing today. Say where claims come from.";

export function buildDiscoverListenMaterial(edition: DiscoverEditionContent): string {
  const brief = edition.brief.map((line) => `- ${line.label}: ${line.text}`);
  const cards = edition.cards.map((card) => {
    switch (card.kind) {
      case "topic":
        return `## ${card.topic}: ${card.title}\n${card.angle}\nWhy it matters to them: ${card.reason}`;
      case "read":
        return `## Reading on ${card.topic}: ${card.title} (${card.source}, ${card.url})\n${card.summary}`;
      case "action":
        return `## Worth doing: ${card.title}\n${card.detail}`;
      case "check_in":
        return `## Checking in\n${card.question}`;
    }
  });

  return [`# Discover edition for ${edition.date}`, "## Brief", ...brief, ...cards].join("\n\n");
}

export function isActiveDiscoverReader(
  entries: readonly DiscoverFeedbackEntry[],
  hasEarlierEditions: boolean,
  now: number,
  days = 3,
): boolean {
  if (!hasEarlierEditions) {
    return true;
  }

  return entries.some((entry) => now - Date.parse(entry.createdAt) <= days * DAY_MS);
}
