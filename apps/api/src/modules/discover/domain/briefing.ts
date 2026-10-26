import {
  DISCOVER_MAX_EDITION_CARDS,
  type DiscoverBriefingDraft,
  type DiscoverCard,
  type DiscoverEditionContent,
} from "@ngriffin_uk/polychat-schemas";

import { discoverTopicKey, listEditionLinks } from "./edition";
import { fillDiscoverFeed } from "./feed";
import { collectSeenLinks, type DiscoverLink } from "./links";
import type { DiscoverResearchResult } from "./research";

export const DISCOVER_BRIEFING_TOPIC_LIMIT = 4;
export const DISCOVER_BRIEFING_LEAD_LIMIT = 2;

export type DiscoverReadCard = Extract<DiscoverCard, { kind: "read" }>;

export interface DiscoverBriefingArticle {
  source: string;
  title: string;
  content: string;
}

export interface DiscoverBriefingText {
  topic: string;
  content: string;
}

function readCards(edition: DiscoverEditionContent): DiscoverReadCard[] {
  return edition.cards.filter((card): card is DiscoverReadCard => card.kind === "read");
}

export function chooseBriefingTopics(
  edition: DiscoverEditionContent,
  first: string | null = null,
  limit = DISCOVER_BRIEFING_TOPIC_LIMIT,
): string[] {
  const seen = new Set<string>();
  const topics: string[] = [];
  const candidates = [
    ...(first ? [first] : []),
    ...edition.cards.flatMap((card) => (card.kind === "topic" ? [card.topic] : [])),
    ...edition.interests.map((interest) => interest.topic),
    ...readCards(edition).map((card) => card.topic),
  ];

  for (const topic of candidates) {
    const key = discoverTopicKey(topic);

    if (key && !seen.has(key) && topics.length < limit) {
      seen.add(key);
      topics.push(topic);
    }
  }

  return topics;
}

export function planEditionResearch(input: {
  edition: DiscoverEditionContent;
  listen: boolean;
  episodeTopic: string | null;
}): string[] {
  if (input.listen) {
    return chooseBriefingTopics(input.edition, input.episodeTopic);
  }

  return input.episodeTopic ? [input.episodeTopic] : [];
}

export function listBriefingReads(
  edition: DiscoverEditionContent,
  topic: string,
): DiscoverReadCard[] {
  const key = discoverTopicKey(topic);

  return readCards(edition).filter((card) => discoverTopicKey(card.topic) === key);
}

export function describeBriefingLeads(
  edition: DiscoverEditionContent,
  topic: string,
): Array<{ topic: string; title: string }> {
  const angles = edition.cards.flatMap((card) =>
    card.kind === "topic" && discoverTopicKey(card.topic) === discoverTopicKey(topic)
      ? [{ topic, title: card.title }]
      : [],
  );
  const reads = listBriefingReads(edition, topic).map((card) => ({ topic, title: card.title }));

  return [...angles, ...reads].slice(0, DISCOVER_BRIEFING_LEAD_LIMIT);
}

export function buildDiscoverBriefingMaterial(
  topic: string,
  articles: readonly DiscoverBriefingArticle[],
): string {
  return [
    `Topic: ${topic}`,
    ...articles.map(
      (article, index) =>
        `## Article ${index + 1}: ${article.source}, "${article.title}"\n\n${article.content}`,
    ),
  ].join("\n\n");
}

export function renderDiscoverBriefing(topic: string, briefing: DiscoverBriefingDraft): string {
  return [
    `# ${topic}`,
    briefing.overview,
    ...briefing.stories.map((story) =>
      [
        `## ${story.headline}`,
        `What happened: ${story.happened}`,
        `Background: ${story.background}`,
        `Why it matters: ${story.stakes}`,
        ...(story.views.length > 0
          ? [`Views:\n${story.views.map((view) => `- ${view}`).join("\n")}`]
          : []),
        `What next: ${story.next}`,
      ].join("\n\n"),
    ),
    ...(briefing.threads.length > 0
      ? [
          `## Worth talking through\n\n${briefing.threads.map((thread) => `- ${thread}`).join("\n")}`,
        ]
      : []),
  ].join("\n\n");
}

export function describeBriefings(briefings: readonly DiscoverBriefingText[]): string[] {
  return briefings.length > 0
    ? [
        "# Research on today's topics, to talk from",
        ...briefings.map((briefing) => briefing.content),
      ]
    : [];
}

export function addResearchedReads(input: {
  edition: DiscoverEditionContent;
  topic: string;
  found: readonly (DiscoverResearchResult & { sourceId: string })[];
  seenLinks: readonly DiscoverLink[];
  createId: () => string;
}): DiscoverEditionContent {
  const key = discoverTopicKey(input.topic);
  const sourceIds = new Map(input.found.map((item) => [item.url, item.sourceId]));
  const added = fillDiscoverFeed({
    groups: [
      {
        topic: input.topic,
        lead: `Found researching ${input.topic}`,
        items: input.found,
        spoken: true,
      },
    ],
    seen: collectSeenLinks([...input.seenLinks, ...listEditionLinks([input.edition])]),
    skipTopics: new Set(),
    limit: DISCOVER_MAX_EDITION_CARDS - input.edition.cards.length,
    createId: input.createId,
  }).map((card) => {
    const sourceId = card.kind === "read" ? sourceIds.get(card.url) : undefined;

    return sourceId ? { ...card, sourceId } : card;
  });

  if (added.length === 0) {
    return input.edition;
  }

  const lastRead = input.edition.cards.reduce(
    (last, card, index) =>
      card.kind === "read" && discoverTopicKey(card.topic) === key ? index : last,
    -1,
  );
  const at = lastRead === -1 ? input.edition.cards.length : lastRead + 1;

  return {
    ...input.edition,
    cards: [...input.edition.cards.slice(0, at), ...added, ...input.edition.cards.slice(at)],
  };
}
