import { DISCOVER_FRESH_HOURS } from "@ngriffin_uk/polychat-schemas";

export interface DiscoverFreshnessInput {
  signals: ReadonlyArray<{ readAt: string | null; attemptedAt: string | null }>;
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

export function isDiscoverGatherFresh(input: DiscoverFreshnessInput): boolean {
  const { signals, research, expectedSignals, now } = input;

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
