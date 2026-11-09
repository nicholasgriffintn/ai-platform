import {
  DISCOVER_ALSO_IN_LIMIT,
  type DiscoverCard,
  type DiscoverEditionContent,
  type StorySummary,
} from "@ngriffin_uk/polychat-schemas";
import { comparableHttpUrl } from "@ngriffin_uk/polychat-utility-core";

import { discoverTopicKey } from "./edition";

const EDITION_STORY_LIMIT = 12;

type ReadCard = Extract<DiscoverCard, { kind: "read" }>;

export type DiscoverStoriesByUrl = ReadonlyMap<string, StorySummary>;

export function findStoryByUrl(
  url: string,
  stories: DiscoverStoriesByUrl,
): StorySummary | undefined {
  return stories.get(comparableHttpUrl(url) ?? "");
}

export function foldIntoStoryCard(lead: ReadCard, card: ReadCard): ReadCard {
  const alsoIn = lead.alsoIn ?? [];

  if (
    alsoIn.length >= DISCOVER_ALSO_IN_LIMIT ||
    card.source === lead.source ||
    alsoIn.some((entry) => entry.url === card.url)
  ) {
    return lead;
  }

  return { ...lead, alsoIn: [...alsoIn, { source: card.source.slice(0, 80), url: card.url }] };
}

export function withCardStory(card: ReadCard, story: StorySummary): ReadCard {
  return { ...card, storyId: story.id, outletCount: story.outletCount };
}

export function refreshCardStory<TCard extends DiscoverCard>(
  card: TCard,
  stories: DiscoverStoriesByUrl,
  overviews: ReadonlyMap<string, string> = new Map(),
): TCard {
  if (card.kind !== "read") {
    return card;
  }

  const story = findStoryByUrl(card.url, stories);
  const overview = story ? overviews.get(story.id) : undefined;

  return story
    ? {
        ...card,
        storyId: story.id,
        outletCount: story.outletCount,
        ...(overview ? { summary: overview } : {}),
      }
    : card;
}

function storyKey(card: DiscoverCard): string | null {
  return card.kind === "read" && card.storyId ? card.storyId : null;
}

export function foldCardsByStory<TItem extends { card: DiscoverCard; publishedAt?: string | null }>(
  items: readonly TItem[],
): TItem[] {
  const groups = new Map<string, TItem[]>();

  for (const item of items) {
    const key = storyKey(item.card);

    if (key) {
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
  }

  return items.flatMap((item) => {
    const key = storyKey(item.card);
    const group = key ? groups.get(key) : undefined;

    if (!key || !group) {
      return [item];
    }

    if (group[0] !== item) {
      return [];
    }

    const [lead, ...rest] = [...group].sort((left, right) =>
      (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""),
    );

    if (!lead || lead.card.kind !== "read") {
      return [item];
    }

    const card = rest.reduce(
      (folded, other) =>
        other.card.kind === "read" ? foldIntoStoryCard(folded, other.card) : folded,
      lead.card,
    );

    return [{ ...lead, card }];
  });
}

export function listEditionStoryIds(editions: readonly DiscoverEditionContent[]): string[] {
  return [
    ...new Set(
      editions.flatMap((edition) =>
        edition.cards.flatMap((card) =>
          (card.kind === "read" || card.kind === "topic") && card.storyId ? [card.storyId] : [],
        ),
      ),
    ),
  ].slice(0, EDITION_STORY_LIMIT);
}

function resolveDiscoverTopicStories(
  articles: ReadonlyArray<{ topic: string; storyId: string }>,
): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();

  for (const article of articles) {
    const key = discoverTopicKey(article.topic);
    const stories = counts.get(key) ?? new Map<string, number>();

    stories.set(article.storyId, (stories.get(article.storyId) ?? 0) + 1);
    counts.set(key, stories);
  }

  return new Map(
    [...counts].flatMap(([key, stories]) => {
      const [lead] = [...stories].sort((left, right) => right[1] - left[1]);

      return lead ? [[key, lead[0]] as const] : [];
    }),
  );
}

export function foldDiscoverStoryCards(
  cards: readonly DiscoverCard[],
  stories: DiscoverStoriesByUrl,
): DiscoverCard[] {
  const folded: DiscoverCard[] = [];
  const leads = new Map<string, number>();
  const articles: Array<{ topic: string; storyId: string }> = [];

  for (const card of cards) {
    const story = card.kind === "read" ? findStoryByUrl(card.url, stories) : undefined;

    if (!story || card.kind !== "read") {
      folded.push(card);
      continue;
    }

    articles.push({ topic: card.topic, storyId: story.id });
    const lead = leads.get(story.id);
    const leadCard = lead === undefined ? undefined : folded[lead];

    if (lead !== undefined && leadCard?.kind === "read") {
      folded[lead] = foldIntoStoryCard(leadCard, card);
      continue;
    }

    leads.set(story.id, folded.length);
    folded.push(withCardStory(card, story));
  }

  const topicStories = resolveDiscoverTopicStories(articles);

  return folded.map((card) => {
    const storyId =
      card.kind === "topic" ? topicStories.get(discoverTopicKey(card.topic)) : undefined;

    return storyId && card.kind === "topic" ? { ...card, storyId } : card;
  });
}
