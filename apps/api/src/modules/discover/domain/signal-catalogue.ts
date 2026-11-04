import { DAILY_SIGNALS } from "./signal-sources/daily";
import { DEVTO_SIGNALS } from "./signal-sources/devto";
import { createDiscoverFeedSignal, isDiscoverFeedSignalId } from "./signal-sources/feeds";
import { GITHUB_SIGNALS } from "./signal-sources/github";
import { LISTENING_SIGNALS } from "./signal-sources/listening";
import { LISTENNOTES_SIGNALS } from "./signal-sources/listennotes";
import { MODEL_SIGNALS } from "./signal-sources/models";
import { NASA_SIGNALS } from "./signal-sources/nasa";
import { PUBLIC_SIGNALS } from "./signal-sources/public";
import { READING_SIGNALS } from "./signal-sources/reading";
import { REDDIT_SIGNALS } from "./signal-sources/reddit";
import { STACK_EXCHANGE_SIGNALS } from "./signal-sources/stack-exchange";
import type {
  DiscoverConnectorSignal,
  DiscoverFirstPartySignal,
  DiscoverPublicSignal,
  DiscoverSignal,
} from "./signal-sources/types";
import { WATCHING_SIGNALS } from "./signal-sources/watching";
import { WORK_SIGNALS } from "./signal-sources/work";
import { YOUTUBE_SIGNALS } from "./signal-sources/youtube";

export const DISCOVER_SIGNALS: readonly DiscoverSignal[] = [
  ...LISTENING_SIGNALS,
  ...LISTENNOTES_SIGNALS,
  ...READING_SIGNALS,
  ...DEVTO_SIGNALS,
  ...WATCHING_SIGNALS,
  ...YOUTUBE_SIGNALS,
  ...DAILY_SIGNALS,
  ...NASA_SIGNALS,
  ...WORK_SIGNALS,
  ...STACK_EXCHANGE_SIGNALS,
  ...REDDIT_SIGNALS,
  ...GITHUB_SIGNALS,
  ...MODEL_SIGNALS,
  ...PUBLIC_SIGNALS,
];

export function isDiscoverPublicSignal(signal: DiscoverSignal): signal is DiscoverPublicSignal {
  return signal.kind === "public";
}

export function isDiscoverConnectorSignal(
  signal: DiscoverSignal,
): signal is DiscoverConnectorSignal {
  return signal.kind !== "public" && signal.kind !== "first_party";
}

export function isDiscoverFirstPartySignal(
  signal: DiscoverSignal,
): signal is DiscoverFirstPartySignal {
  return signal.kind === "first_party";
}

export function listDiscoverSignalOperations(signal: DiscoverConnectorSignal): string[] {
  return signal.expand ? [signal.operation, signal.expand.operation] : [signal.operation];
}

export function showsDiscoverActivity(signalId: string): boolean {
  const signal = findDiscoverSignal(signalId);

  return signal?.kind !== "public" && !signal?.needsTopics && !signal?.notActivity;
}

export function isDiscoverOptInProvider(providerId: string): boolean {
  return PUBLIC_SIGNALS.some((signal) => signal.providerId === providerId);
}

export function listDiscoverFeedSignals(feeds: readonly string[]): DiscoverPublicSignal[] {
  return feeds.map(createDiscoverFeedSignal);
}

export function findDiscoverSignal(id: string): DiscoverSignal | undefined {
  return DISCOVER_SIGNALS.find((signal) => signal.id === id);
}

export function isKnownDiscoverSignalId(id: string): boolean {
  return findDiscoverSignal(id) !== undefined || isDiscoverFeedSignalId(id);
}
