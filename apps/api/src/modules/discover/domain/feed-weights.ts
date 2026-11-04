import { discoverTopicKey } from "./edition";
import {
  keepDiscoverFeedbackSince,
  summariseDiscoverFeedback,
  type DiscoverFeedbackEntry,
} from "./feedback";

const MORE_WEIGHT = 2;
const LESS_WEIGHT = 0.5;
const ENGAGEMENT_STEP = 0.1;
const ENGAGEMENT_CAP = 0.5;
const IGNORED_MIN_SHOWN = 20;
const IGNORED_MAX_OPEN_RATE = 0.05;

export interface DiscoverFeedPreferences {
  more: ReadonlySet<string>;
  less: ReadonlySet<string>;
  ignored: ReadonlySet<string>;
  engaged: ReadonlyMap<string, number>;
}

export interface DiscoverTopicExposure {
  topics: ReadonlyMap<string, number>;
  since: number;
}

export const NO_DISCOVER_FEED_PREFERENCES: DiscoverFeedPreferences = {
  more: new Set(),
  less: new Set(),
  ignored: new Set(),
  engaged: new Map(),
};

function countOpenedTopics(entries: readonly DiscoverFeedbackEntry[]): Map<string, number> {
  const opened = new Map<string, number>();

  for (const entry of entries) {
    if (entry.topic && (entry.signal === "opened" || entry.signal === "saved")) {
      const key = discoverTopicKey(entry.topic);

      opened.set(key, (opened.get(key) ?? 0) + 1);
    }
  }

  return opened;
}

function findIgnoredTopics(
  entries: readonly DiscoverFeedbackEntry[],
  exposure: DiscoverTopicExposure | undefined,
): Set<string> {
  const opened = countOpenedTopics(keepDiscoverFeedbackSince(entries, exposure?.since ?? 0));

  return new Set(
    [...(exposure?.topics ?? [])].flatMap(([topic, shown]) =>
      shown >= IGNORED_MIN_SHOWN && (opened.get(topic) ?? 0) / shown < IGNORED_MAX_OPEN_RATE
        ? [topic]
        : [],
    ),
  );
}

export function summariseDiscoverFeedPreferences(
  entries: readonly DiscoverFeedbackEntry[],
  exposure?: DiscoverTopicExposure,
): DiscoverFeedPreferences {
  const summary = summariseDiscoverFeedback(entries);

  return {
    more: new Set(summary.moreTopics.map(discoverTopicKey)),
    less: new Set(summary.lessTopics.map(discoverTopicKey)),
    ignored: findIgnoredTopics(entries, exposure),
    engaged: countOpenedTopics(entries),
  };
}

export function weighDiscoverFeedTopic(
  topic: string,
  preferences: DiscoverFeedPreferences,
): number {
  const key = discoverTopicKey(topic);

  if (preferences.less.has(key) || (preferences.ignored.has(key) && !preferences.more.has(key))) {
    return LESS_WEIGHT;
  }

  const base = preferences.more.has(key) ? MORE_WEIGHT : 1;

  return base + Math.min(ENGAGEMENT_CAP, (preferences.engaged.get(key) ?? 0) * ENGAGEMENT_STEP);
}
