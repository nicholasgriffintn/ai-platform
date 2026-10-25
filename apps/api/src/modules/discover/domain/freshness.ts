import { DISCOVER_FRESH_HOURS } from "@ngriffin_uk/polychat-schemas";
import { DAY_MS } from "@ngriffin_uk/polychat-utility-core";

import { readDeviceActivitySource } from "./device-activity";

const DISCOVER_SIGNAL_CURRENT_DAYS = 3;

export interface DiscoverFreshnessInput {
  signals: ReadonlyArray<{
    providerId: string;
    readAt: string | null;
    attemptedAt: string | null;
  }>;
  research: ReadonlyArray<{ readAt: string | null }>;
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

export function isDiscoverSignalCurrent(readAt: string | null, now: number): boolean {
  return (
    readAt !== null &&
    Number.isFinite(Date.parse(readAt)) &&
    now - Date.parse(readAt) < DISCOVER_SIGNAL_CURRENT_DAYS * DAY_MS
  );
}

export function isDiscoverGatherFresh(input: DiscoverFreshnessInput): boolean {
  const { research, expectedSignals, now } = input;
  const signals = input.signals.filter(
    (document) => readDeviceActivitySource(document.providerId) === null,
  );

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
  const researchFresh =
    research.length === 0 ||
    research.some((document) => isDiscoverTimestampFresh(document.readAt, now));

  return signalsFresh && researchFresh;
}
