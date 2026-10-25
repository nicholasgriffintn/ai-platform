import type { DiscoverCard, DiscoverCoverageDraft } from "@ngriffin_uk/polychat-schemas";

import { discoverTopicKey } from "./edition";

export interface DiscoverCoverageArticle {
  source: string;
  title: string;
  content: string;
}

export function listTopicArticleCards(
  cards: readonly DiscoverCard[],
  topic: string,
): Extract<DiscoverCard, { kind: "read" }>[] {
  const key = discoverTopicKey(topic);

  return cards.filter(
    (card): card is Extract<DiscoverCard, { kind: "read" }> =>
      card.kind === "read" && Boolean(card.sourceId) && discoverTopicKey(card.topic) === key,
  );
}

export function buildDiscoverCoverageMaterial(
  topic: string,
  articles: readonly DiscoverCoverageArticle[],
): string {
  return [
    `Topic: ${topic}`,
    ...articles.map(
      (article, index) =>
        `## Article ${index + 1}: ${article.source}, "${article.title}"\n\n${article.content}`,
    ),
  ].join("\n\n");
}

function renderList(heading: string, items: readonly string[]): string[] {
  return items.length > 0
    ? [`## ${heading}\n\n${items.map((item) => `- ${item}`).join("\n")}`]
    : [];
}

export function renderDiscoverCoverage(coverage: DiscoverCoverageDraft): string {
  return [
    coverage.overview,
    ...renderList("What they agree on", coverage.agreed),
    ...renderList(
      "How each outlet tells it",
      coverage.outlets.map((outlet) => `**${outlet.source}:** ${outlet.angle}`),
    ),
    ...renderList("Where they differ", coverage.disputed),
    ...renderList("What's missing", coverage.gaps),
  ].join("\n\n");
}
