import {
  DISCOVER_TRANSIT_LINES,
  type DiscoverLineReading,
  type DiscoverLineStatusPreferences,
  type DiscoverObservation,
} from "@ngriffin_uk/polychat-schemas";
import { truncateSingleLine } from "@ngriffin_uk/polychat-utility-core";

const GOOD_SEVERITIES = new Set([10, 18, 19]);
const LINE_STATUS_LIFETIME_MS = 10 * 60 * 1000;
const MAX_LINES = 8;
const STATUS_URL = "https://tfl.gov.uk/tube-dlr-overground/status/";
const KNOWN_LINES = new Set<string>(DISCOVER_TRANSIT_LINES.map((line) => line.id));

export interface DiscoverLineSource {
  id: string;
  name: string;
  statuses: readonly { severity: number; description: string; reason: string | null }[];
}

export function selectDiscoverLines(
  preferences: DiscoverLineStatusPreferences,
  nearby: readonly string[],
): string[] {
  if (!preferences.enabled) {
    return [];
  }

  const candidates = [...preferences.lines, ...(preferences.nearby ? nearby : [])];

  return [...new Set(candidates.filter((line) => KNOWN_LINES.has(line)))].slice(0, MAX_LINES);
}

function findDisruption(
  reading: DiscoverLineSource,
): DiscoverLineSource["statuses"][number] | undefined {
  return reading.statuses.find((item) => !GOOD_SEVERITIES.has(item.severity));
}

export function presentDiscoverLineReadings(
  readings: readonly DiscoverLineSource[],
  input: { lines: readonly string[]; nearby: readonly string[] },
): DiscoverLineReading[] {
  const order = new Map(input.lines.map((line, index) => [line, index]));
  const nearby = new Set(input.nearby);

  return readings
    .filter((reading) => order.has(reading.id))
    .map((reading) => {
      const disruption = findDisruption(reading);

      return {
        id: reading.id,
        name: reading.name,
        status: disruption?.description ?? "Good Service",
        disrupted: disruption !== undefined,
        reason: disruption?.reason ?? null,
        nearby: nearby.has(reading.id),
      };
    })
    .sort(
      (left, right) =>
        Number(right.disrupted) - Number(left.disrupted) ||
        (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0),
    );
}

function lineLabel(name: string): string {
  return /line$|^dlr$|^tram$/iu.test(name) ? name : `${name} line`;
}

function joinNames(names: readonly string[]): string {
  return names.length <= 1
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function describeDiscoverLineStatus(
  readings: readonly DiscoverLineSource[],
  input: { lines: readonly string[]; now: Date },
): DiscoverObservation[] {
  const order = new Map(input.lines.map((line, index) => [line, index]));
  const observedAt = input.now.toISOString();
  const expiresAt = new Date(input.now.getTime() + LINE_STATUS_LIFETIME_MS).toISOString();
  const relevant = readings
    .filter((reading) => order.has(reading.id))
    .sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
  const disrupted = relevant.flatMap((reading) => {
    const status = findDisruption(reading);

    return status ? [{ reading, status }] : [];
  });
  const observations: DiscoverObservation[] = disrupted.slice(0, 3).map(({ reading, status }) => ({
    id: `lines:${reading.id}`,
    kind: "lines",
    title: lineLabel(reading.name),
    text: truncateSingleLine(
      status.reason ?? `${status.description} on the ${lineLabel(reading.name)}.`,
      1000,
    ),
    source: status.description,
    providerId: "tfl",
    href: STATUS_URL,
    observedAt,
    expiresAt,
    actionable: false,
    fingerprint: `${reading.id}:${status.severity}`,
    stale: false,
  }));
  const good = relevant.filter(
    (reading) => !disrupted.some((item) => item.reading.id === reading.id),
  );

  if (good.length > 0) {
    observations.push({
      id: "lines:good",
      kind: "lines",
      title: "Good service",
      text: truncateSingleLine(
        `Good service on the ${joinNames(good.map((reading) => lineLabel(reading.name)))}.`,
        1000,
      ),
      source: "Good service",
      providerId: "tfl",
      href: STATUS_URL,
      observedAt,
      expiresAt,
      actionable: false,
      fingerprint: good
        .map((reading) => reading.id)
        .join(",")
        .slice(0, 100),
      stale: false,
    });
  }

  return observations;
}
