import { discoverTopicKey } from "./edition";
import { summariseDiscoverFeedback, type DiscoverFeedbackEntry } from "./feedback";

const MORE_WEIGHT = 2;
const LESS_WEIGHT = 0.5;
const ENGAGEMENT_STEP = 0.1;
const ENGAGEMENT_CAP = 0.5;

export interface DiscoverFeedPreferences {
  more: ReadonlySet<string>;
  less: ReadonlySet<string>;
  engaged: ReadonlyMap<string, number>;
}

export const NO_DISCOVER_FEED_PREFERENCES: DiscoverFeedPreferences = {
  more: new Set(),
  less: new Set(),
  engaged: new Map(),
};

export function summariseDiscoverFeedPreferences(
  entries: readonly DiscoverFeedbackEntry[],
): DiscoverFeedPreferences {
  const summary = summariseDiscoverFeedback(entries);
  const engaged = new Map<string, number>();

  for (const entry of entries) {
    if (entry.topic && (entry.signal === "opened" || entry.signal === "saved")) {
      const key = discoverTopicKey(entry.topic);

      engaged.set(key, (engaged.get(key) ?? 0) + 1);
    }
  }

  return {
    more: new Set(summary.moreTopics.map(discoverTopicKey)),
    less: new Set(summary.lessTopics.map(discoverTopicKey)),
    engaged,
  };
}

export function weighDiscoverFeedTopic(
  topic: string,
  preferences: DiscoverFeedPreferences,
): number {
  const key = discoverTopicKey(topic);

  if (preferences.less.has(key)) {
    return LESS_WEIGHT;
  }

  const base = preferences.more.has(key) ? MORE_WEIGHT : 1;

  return base + Math.min(ENGAGEMENT_CAP, (preferences.engaged.get(key) ?? 0) * ENGAGEMENT_STEP);
}
