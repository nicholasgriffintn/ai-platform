import { DISCOVER_FRESH_HOURS } from "@ngriffin_uk/polychat-schemas";

import { discoverTopicKey } from "./edition";

export interface DiscoverFreshnessInput {
  signals: ReadonlyArray<{ readAt: string | null; attemptedAt: string | null }>;
  research: ReadonlyArray<{ topic: string; readAt: string | null }>;
  topics: readonly string[];
  expectedSignals: number;
  now: number;
}

export function isDiscoverTimestampFresh(value: string | null, now: number): boolean {
  return (
    value !== null &&
    Number.isFinite(Date.parse(value)) &&
    now - Date.parse(value) < DISCOVER_FRESH_HOURS * 60 * 60 * 1000
  );
}

export function isDiscoverGatherFresh(input: DiscoverFreshnessInput): boolean {
  const { signals, research, topics, expectedSignals, now } = input;

  if (signals.length === 0 && research.length === 0) {
    return false;
  }

  const signalsFresh =
    expectedSignals === 0 ||
    signals.some(
      (document) =>
        isDiscoverTimestampFresh(document.readAt, now) ||
        isDiscoverTimestampFresh(document.attemptedAt, now),
    );
  const freshResearch = research.filter((document) =>
    isDiscoverTimestampFresh(document.readAt, now),
  );
  const researched = new Set(freshResearch.map((document) => discoverTopicKey(document.topic)));
  const topicsFresh = topics.every((topic) => researched.has(discoverTopicKey(topic)));
  const researchFresh = research.length === 0 || freshResearch.length > 0;

  return signalsFresh && topicsFresh && researchFresh;
}
