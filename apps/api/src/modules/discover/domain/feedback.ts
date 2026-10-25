import type { DiscoverFeedbackSignal } from "@ngriffin_uk/polychat-schemas";
import { sortCopy } from "@ngriffin_uk/polychat-utility-core";

import { discoverTopicKey } from "./edition";

export interface DiscoverFeedbackEntry {
  editionId: string;
  cardId: string;
  signal: DiscoverFeedbackSignal;
  topic: string | null;
  title: string;
  url: string | null;
  createdAt: string;
}

export interface DiscoverFeedbackSummary {
  moreTopics: string[];
  lessTopics: string[];
  hiddenTopics: string[];
  saved: Array<{ title: string; url: string | null }>;
}

const PREFERENCE_SIGNALS = new Set<DiscoverFeedbackSignal>(["more", "less", "hide"]);

function byCreatedAt(left: DiscoverFeedbackEntry, right: DiscoverFeedbackEntry): number {
  return left.createdAt.localeCompare(right.createdAt);
}

export function summariseDiscoverFeedback(
  entries: readonly DiscoverFeedbackEntry[],
): DiscoverFeedbackSummary {
  const preferences = new Map<string, { topic: string; signal: DiscoverFeedbackSignal }>();
  const saved = new Map<string, { title: string; url: string | null }>();

  for (const entry of sortCopy(entries, byCreatedAt)) {
    if (entry.signal === "saved") {
      saved.set(`${entry.editionId}:${entry.cardId}`, { title: entry.title, url: entry.url });
      continue;
    }

    if (entry.topic && PREFERENCE_SIGNALS.has(entry.signal)) {
      preferences.set(discoverTopicKey(entry.topic), { topic: entry.topic, signal: entry.signal });
    }
  }

  const topicsWith = (signal: DiscoverFeedbackSignal) =>
    [...preferences.values()]
      .filter((preference) => preference.signal === signal)
      .map((preference) => preference.topic);

  return {
    moreTopics: topicsWith("more"),
    lessTopics: topicsWith("less"),
    hiddenTopics: topicsWith("hide"),
    saved: [...saved.values()].reverse(),
  };
}

export function collectCardSignals(
  entries: readonly DiscoverFeedbackEntry[],
  editionId: string,
): Record<string, DiscoverFeedbackSignal[]> {
  const signals: Record<string, DiscoverFeedbackSignal[]> = {};

  for (const entry of sortCopy(entries, byCreatedAt)) {
    if (entry.editionId !== editionId) {
      continue;
    }

    const current = (signals[entry.cardId] ?? []).filter(
      (signal) => !PREFERENCE_SIGNALS.has(entry.signal) || !PREFERENCE_SIGNALS.has(signal),
    );

    signals[entry.cardId] = current.includes(entry.signal) ? current : [...current, entry.signal];
  }

  return signals;
}
