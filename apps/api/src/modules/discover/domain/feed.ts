import { discoverCardSchema, type DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import {
  comparableHttpUrl,
  readUrlHost,
  truncateSingleLine,
} from "@ngriffin_uk/polychat-utility-core";

import { discoverTopicKey } from "./edition";
import { claimUnseenLink, type SeenDiscoverLinks } from "./links";
import type { DiscoverResearchResult } from "./research";

export interface DiscoverFeedGroup {
  topic: string;
  lead: string;
  items: readonly DiscoverResearchResult[];
  spoken?: boolean;
}

export interface DiscoverFeedSources {
  research: ReadonlyArray<{ topic: string; results: readonly DiscoverResearchResult[] }>;
  signals: ReadonlyArray<{ title: string; items: readonly DiscoverResearchResult[] }>;
  headlinesTopic: string;
  followedTopics: ReadonlySet<string>;
  curate: string;
  interestOrder: readonly string[];
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

  return key === discoverTopicKey(sources.headlinesTopic) ? 3 : 2;
}

export function buildDiscoverFeedGroups(sources: DiscoverFeedSources): DiscoverFeedGroup[] {
  const research = [...sources.research]
    .filter((document) => document.results.length > 0)
    .sort((left, right) => researchRank(left.topic, sources) - researchRank(right.topic, sources))
    .map((document) => ({
      topic: document.topic,
      lead: describeLead(document.topic, sources),
      items: document.results,
      spoken: researchRank(document.topic, sources) < 2,
    }));
  const signals = sources.signals
    .filter((signal) => signal.items.length > 0)
    .map((signal) => ({ topic: signal.title, lead: `From ${signal.title}`, items: signal.items }));

  return [...research, ...signals];
}

function describeItemSource(item: DiscoverResearchResult): string {
  return [item.source ?? "", item.date ?? ""].filter(Boolean).join(", ");
}

function newestFirst(items: readonly DiscoverResearchResult[]): DiscoverResearchResult[] {
  return [...items].sort((left, right) => (right.date ?? "").localeCompare(left.date ?? ""));
}

interface FeedQueue {
  group: DiscoverFeedGroup;
  remaining: DiscoverResearchResult[];
}

function fillRound(
  queues: readonly FeedQueue[],
  seen: SeenDiscoverLinks,
  createId: () => string,
): DiscoverCard[] {
  const cards: DiscoverCard[] = [];

  for (const queue of queues) {
    while (queue.remaining.length > 0) {
      const item = queue.remaining.shift();
      const url = item ? comparableHttpUrl(item.url) : null;

      if (!item || !url || !claimUnseenLink(seen, item)) {
        continue;
      }

      const source = describeItemSource(item);
      const card = discoverCardSchema.safeParse({
        id: createId(),
        kind: "read",
        topic: truncateSingleLine(queue.group.topic, 60),
        title: truncateSingleLine(item.title, 160),
        url: item.url,
        source: truncateSingleLine(item.source || readUrlHost(url), 80),
        summary: truncateSingleLine(item.snippet || item.title, 400),
        reason: truncateSingleLine(
          source ? `${queue.group.lead}. ${source}` : queue.group.lead,
          200,
        ),
        sensitive: false,
      });

      if (card.success) {
        cards.push(card.data);

        break;
      }
    }
  }

  return cards;
}

export function fillDiscoverFeed(input: {
  groups: readonly DiscoverFeedGroup[];
  seen: SeenDiscoverLinks;
  skipTopics: ReadonlySet<string>;
  limit: number;
  createId: () => string;
}): DiscoverCard[] {
  const queues = input.groups
    .filter((group) => !input.skipTopics.has(discoverTopicKey(group.topic)))
    .map((group) => ({ group, remaining: newestFirst(group.items) }));
  const tiers = [
    queues.filter((queue) => queue.group.spoken),
    queues.filter((queue) => !queue.group.spoken),
  ];
  const cards: DiscoverCard[] = [];

  for (const tier of tiers) {
    for (;;) {
      const round = fillRound(tier, input.seen, input.createId);

      if (round.length === 0) {
        break;
      }

      cards.push(...round);
    }
  }

  return cards.slice(0, Math.max(0, input.limit));
}
