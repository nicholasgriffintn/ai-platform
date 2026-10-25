import { discoverCardSchema, type DiscoverCard } from "@ngriffin_uk/polychat-schemas";
import {
  comparableHttpUrl,
  readUrlHost,
  truncateSingleLine,
} from "@ngriffin_uk/polychat-utility-core";

import { discoverTopicKey } from "./edition";
import type { DiscoverResearchResult } from "./research";

export const DISCOVER_FEED_ITEMS_PER_GROUP = 3;

export interface DiscoverFeedGroup {
  topic: string;
  lead: string;
  items: readonly DiscoverResearchResult[];
}

export interface DiscoverFeedSources {
  research: ReadonlyArray<{ topic: string; results: readonly DiscoverResearchResult[] }>;
  signals: ReadonlyArray<{ title: string; items: readonly DiscoverResearchResult[] }>;
  headlinesTopic: string;
  followedTopics: ReadonlySet<string>;
  curate: string;
  interestOrder: readonly string[];
}

function describeLead(topic: string, sources: DiscoverFeedSources): string {
  const key = discoverTopicKey(topic);

  if (key === discoverTopicKey(sources.headlinesTopic)) {
    return "Today's headlines";
  }

  if (sources.followedTopics.has(key)) {
    return `You follow ${topic}`;
  }

  if (discoverTopicKey(sources.curate).includes(key)) {
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
    }));
  const signals = sources.signals
    .filter((signal) => signal.items.length > 0)
    .map((signal) => ({ topic: signal.title, lead: `From ${signal.title}`, items: signal.items }));

  return [...research, ...signals];
}

function describeItemSource(item: DiscoverResearchResult): string {
  return [item.source ?? "", item.date ?? ""].filter(Boolean).join(", ");
}

export function fillDiscoverFeed(input: {
  groups: readonly DiscoverFeedGroup[];
  seenUrls: Set<string>;
  skipTopics: ReadonlySet<string>;
  limit: number;
  createId: () => string;
}): DiscoverCard[] {
  const queues = input.groups
    .filter((group) => !input.skipTopics.has(discoverTopicKey(group.topic)))
    .map((group) => ({ group, remaining: [...group.items], taken: 0 }));
  const cards: DiscoverCard[] = [];

  while (cards.length < input.limit) {
    let added = false;

    for (const queue of queues) {
      if (cards.length >= input.limit || queue.taken >= DISCOVER_FEED_ITEMS_PER_GROUP) {
        continue;
      }

      while (queue.remaining.length > 0) {
        const item = queue.remaining.shift();
        const url = item ? comparableHttpUrl(item.url) : null;

        if (!item || !url || input.seenUrls.has(url)) {
          continue;
        }

        const source = describeItemSource(item);
        const card = discoverCardSchema.safeParse({
          id: input.createId(),
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

        if (!card.success) {
          continue;
        }

        input.seenUrls.add(url);
        queue.taken += 1;
        added = true;
        cards.push(card.data);

        break;
      }
    }

    if (!added) {
      break;
    }
  }

  return cards;
}
