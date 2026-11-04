import { discoverCardSchema, type DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import {
  comparableHttpUrl,
  interleaveBy,
  readUrlHost,
  truncateSingleLine,
} from "@ngriffin_uk/polychat-utility-core";

import { readDeviceActivitySource } from "./device-activity";
import { discoverTopicKey } from "./edition";
import {
  NO_DISCOVER_FEED_PREFERENCES,
  weighDiscoverFeedTopic,
  type DiscoverFeedPreferences,
} from "./feed-weights";
import { claimUnseenLink, type SeenDiscoverLinks } from "./links";
import { isDiscoverNewsTopic } from "./news-categories";
import type { DiscoverResearchResult } from "./research";

export interface DiscoverFeedGroup {
  topic: string;
  lead: string;
  items: readonly DiscoverResearchResult[];
  spoken?: boolean;
  ranked?: boolean;
  weight?: number;
}

export interface DiscoverFeedSources {
  research: ReadonlyArray<{ topic: string; results: readonly DiscoverResearchResult[] }>;
  signals: ReadonlyArray<{ title: string; items: readonly DiscoverResearchResult[] }>;
  headlinesTopic: string;
  followedTopics: ReadonlySet<string>;
  curate: string;
  interestOrder: readonly string[];
  preferences?: DiscoverFeedPreferences;
}

function wasAskedFor(key: string, sources: DiscoverFeedSources): boolean {
  return key.length > 0 && discoverTopicKey(sources.curate).includes(key);
}

function describeLead(topic: string, sources: DiscoverFeedSources): string {
  const key = discoverTopicKey(topic);

  if (key === discoverTopicKey(sources.headlinesTopic)) {
    return "Today's headlines";
  }

  if (sources.followedTopics.has(key)) {
    return `You follow ${topic}`;
  }

  if (isDiscoverNewsTopic(topic)) {
    return `From your ${topic}`;
  }

  if (wasAskedFor(key, sources)) {
    return `You asked for ${topic}`;
  }

  return `What you have been into lately: ${topic}`;
}

function researchRank(topic: string, sources: DiscoverFeedSources): number {
  const key = discoverTopicKey(topic);

  if (sources.followedTopics.has(key)) {
    return 0;
  }

  const position = sources.interestOrder.findIndex(
    (interest) => discoverTopicKey(interest) === key,
  );

  if (position !== -1) {
    return 1 + position / 100;
  }

  if (key !== discoverTopicKey(sources.headlinesTopic) && wasAskedFor(key, sources)) {
    return 1.5;
  }

  if (isDiscoverNewsTopic(topic)) {
    return 2.5;
  }

  return key === discoverTopicKey(sources.headlinesTopic) ? 3 : 2;
}

export function splitDiscoverSignalFeeds<T extends { providerId: string; error: string | null }>(
  signals: readonly T[],
): { browsed: T[]; shared: T[] } {
  const readable = signals.filter((signal) => !signal.error);

  return {
    browsed: readable.filter((signal) => readDeviceActivitySource(signal.providerId) !== null),
    shared: readable.filter((signal) => readDeviceActivitySource(signal.providerId) === null),
  };
}

export function buildDiscoverFeedGroups(sources: DiscoverFeedSources): DiscoverFeedGroup[] {
  const preferences = sources.preferences ?? NO_DISCOVER_FEED_PREFERENCES;
  const research = [...sources.research]
    .filter((document) => document.results.length > 0)
    .sort((left, right) => researchRank(left.topic, sources) - researchRank(right.topic, sources))
    .map((document) => ({
      topic: document.topic,
      lead: describeLead(document.topic, sources),
      items: document.results,
      spoken: researchRank(document.topic, sources) < 2,
      weight: weighDiscoverFeedTopic(document.topic, preferences),
    }));
  const signals = sources.signals
    .filter((signal) => signal.items.length > 0)
    .map((signal) => ({
      topic: signal.title,
      lead: `From ${signal.title}`,
      items: signal.items,
      ranked: true,
      weight: weighDiscoverFeedTopic(signal.title, preferences),
    }))
    .sort((left, right) => right.weight - left.weight);

  return [...research, ...signals];
}

function describeItemSource(item: DiscoverResearchResult, topic: string): string {
  const source = item.source ?? "";
  const origin = source.startsWith(topic) ? source.slice(topic.length).replace(/^, /u, "") : source;

  return [origin, item.date ?? ""].filter(Boolean).join(", ");
}

function newestFirst(items: readonly DiscoverResearchResult[]): DiscoverResearchResult[] {
  return [...items].sort((left, right) => (right.date ?? "").localeCompare(left.date ?? ""));
}

interface FeedQueue {
  group: DiscoverFeedGroup;
  remaining: DiscoverResearchResult[];
  credit: number;
}

function takeCard(
  queue: FeedQueue,
  seen: SeenDiscoverLinks,
  createId: () => string,
): DiscoverCard | null {
  while (queue.remaining.length > 0) {
    const item = queue.remaining.shift();
    const url = item ? comparableHttpUrl(item.url) : null;

    if (!item || !url || !claimUnseenLink(seen, item)) {
      continue;
    }

    const source = describeItemSource(item, queue.group.topic);
    const card = discoverCardSchema.safeParse({
      id: createId(),
      kind: item.media ?? "read",
      topic: truncateSingleLine(queue.group.topic, 60),
      title: truncateSingleLine(item.title, 160),
      url: item.url,
      source: truncateSingleLine(item.source || readUrlHost(url), 80),
      summary: truncateSingleLine(item.snippet || item.title, 400),
      reason: truncateSingleLine(source ? `${queue.group.lead}. ${source}` : queue.group.lead, 200),
      sensitive: false,
    });

    if (card.success) {
      return card.data;
    }
  }

  return null;
}

function fillRound(
  queues: readonly FeedQueue[],
  seen: SeenDiscoverLinks,
  createId: () => string,
): DiscoverCard[] {
  const cards: DiscoverCard[] = [];

  for (const queue of queues) {
    queue.credit += queue.group.weight ?? 1;

    while (queue.credit >= 1) {
      const card = takeCard(queue, seen, createId);

      if (!card) {
        queue.credit = 0;
        break;
      }

      cards.push(card);
      queue.credit -= 1;
    }
  }

  return cards;
}

interface DiscoverFeedFill {
  groups: readonly DiscoverFeedGroup[];
  seen: SeenDiscoverLinks;
  skipTopics: ReadonlySet<string>;
  limit: number;
  createId: () => string;
}

export function fillDiscoverFeed(input: DiscoverFeedFill): DiscoverCard[] {
  const queues = input.groups
    .filter((group) => !input.skipTopics.has(discoverTopicKey(group.topic)))
    .map((group) => ({
      group,
      remaining: group.ranked
        ? [...group.items]
        : interleaveBy(newestFirst(group.items), (item) => item.source ?? ""),
      credit: 0,
    }));
  const tiers = [
    queues.filter((queue) => queue.group.spoken),
    queues.filter((queue) => !queue.group.spoken),
  ];
  const cards: DiscoverCard[] = [];

  for (const tier of tiers) {
    while (cards.length < input.limit && tier.some((queue) => queue.remaining.length > 0)) {
      cards.push(...fillRound(tier, input.seen, input.createId));
    }
  }

  return cards.slice(0, Math.max(0, input.limit));
}

export function fillDiscoverLiveFeed(
  input: DiscoverFeedFill & { newsSlots: number },
): DiscoverCard[] {
  const news = input.groups.filter((group) => isDiscoverNewsTopic(group.topic));
  const supply = news.reduce((total, group) => total + group.items.length, 0);
  const others = fillDiscoverFeed({
    ...input,
    groups: input.groups.filter((group) => !isDiscoverNewsTopic(group.topic)),
    limit: input.limit - Math.min(input.newsSlots, supply),
  });

  return [
    ...others,
    ...fillDiscoverFeed({ ...input, groups: news, limit: input.limit - others.length }),
  ];
}
