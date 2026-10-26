import type { DiscoverEditionContent } from "@ngriffin_uk/polychat-schemas";
import { DAY_MS } from "@ngriffin_uk/polychat-utility-core";

import { describeBriefings, type DiscoverBriefingText } from "./briefing";
import type { DiscoverFeedbackEntry } from "./feedback";

export const DISCOVER_LISTEN_SHOW = "The Perch";

export const DISCOVER_LISTEN_FOCUS =
  "A warm, unhurried morning conversation for one listener, built on the research. Open with the brief, then pick the two or three topics with the most to say and go deep on each: what happened, how it got here, why it matters, the different views on it and what to watch next, as two people who have done the reading and have opinions. Pass over the rest of the edition in a line each. Never talk about headlines, scores, points, upvotes or what a piece does or does not say: talk about the subject itself. Give the listener's own projects one line at most. Close by reminding them what is worth doing today.";

const LISTEN_STORY_LIMIT = 12;

type EditionCard = DiscoverEditionContent["cards"][number];

function describeCard(card: EditionCard): string {
  switch (card.kind) {
    case "topic":
      return `## ${card.topic}: ${card.title}\n${card.angle}\nWhy it matters to them: ${card.reason}`;
    case "read":
      return `## Reading on ${card.topic}: ${card.title} (${card.source})\n${card.summary}`;
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
    default:
      return "";
  }
}

export function buildDiscoverListenMaterial(
  edition: DiscoverEditionContent,
  briefings: readonly DiscoverBriefingText[] = [],
): string {
  const brief = edition.brief.map((line) => `- ${line.label}: ${line.text}`);
  const stories = edition.cards
    .filter((card) => card.kind !== "topic" && card.kind !== "action")
    .slice(0, LISTEN_STORY_LIMIT);
  const projects = edition.cards.filter((card) => card.kind === "topic" || card.kind === "action");

  return [
    `# Discover edition for ${edition.date}`,
    "## Brief",
    ...brief,
    ...describeBriefings(briefings),
    ...(stories.length > 0 ? ["# Also in today's edition"] : []),
    ...stories.map(describeCard).filter(Boolean),
    ...(projects.length > 0 ? ["## Their own projects, for one passing line at most"] : []),
    ...projects.map(describeCard),
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
