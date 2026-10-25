import type { DiscoverEditionContent } from "@ngriffin_uk/polychat-schemas";
import { DAY_MS } from "@ngriffin_uk/polychat-utility-core";

import type { DiscoverFeedbackEntry } from "./feedback";

export const DISCOVER_LISTEN_SHOW = "The Perch";

export const DISCOVER_LISTEN_FOCUS =
  "A warm, unhurried morning round-up for one listener. Open with the brief, then spend most of the time on the stories themselves: the articles, newsletters and events, what they report and why they are interesting, as two people who have read them. Give the listener's own projects one line at most. Close by reminding them what is worth doing today.";

export function buildDiscoverListenMaterial(edition: DiscoverEditionContent): string {
  const brief = edition.brief.map((line) => `- ${line.label}: ${line.text}`);
  const cards = edition.cards.map((card) => {
    switch (card.kind) {
      case "topic":
        return `## ${card.topic}: ${card.title}\n${card.angle}\nWhy it matters to them: ${card.reason}`;
      case "read":
        return `## Reading on ${card.topic}: ${card.title} (${card.source}, ${card.url})\n${card.summary}`;
      case "watch":
        return `## Worth watching on ${card.topic}: ${card.title} (${card.source})\n${card.summary}`;
      case "listen":
        return `## Worth hearing on ${card.topic}: ${card.title} (${card.source})\n${card.summary}`;
      case "event":
        return `## Coming up: ${card.title}, ${card.when}${card.where ? ` at ${card.where}` : ""}\n${card.detail}`;
      case "inbox":
        return `## From ${card.source}: ${card.title}\n${card.summary}`;
      case "action":
        return `## Worth doing: ${card.title}\n${card.detail}`;
      case "check_in":
        return `## Checking in\n${card.question}`;
    }
  });

  const stories = edition.cards.filter((card) => card.kind !== "topic" && card.kind !== "action");
  const projects = edition.cards.filter((card) => card.kind === "topic" || card.kind === "action");
  const describe = (card: DiscoverEditionContent["cards"][number]) =>
    cards[edition.cards.indexOf(card)] ?? "";

  return [
    `# Discover edition for ${edition.date}`,
    "## Brief",
    ...brief,
    ...stories.map(describe),
    ...(projects.length > 0 ? ["## Their own projects, for one passing line at most"] : []),
    ...projects.map(describe),
  ].join("\n\n");
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
