import type { CoverageTracker } from "@ngriffin_uk/polychat-schemas";

import { TOPIC_SERIES_COLOURS, topicSwatches, type TopicSwatch } from "./tracker-colours.js";

type ThisWeek = CoverageTracker["thisWeek"];
type TopicCount = ThisWeek["outlets"][number]["current"][number];

export const COVERAGE_TRACKER_WEEKS = 8;

const OUTLET_LIMIT = 6;

export interface WeekBarSegment {
  key: string;
  label: string;
  colour: string;
  articleCount: number;
}

export interface WeekBar {
  total: number;
  segments: WeekBarSegment[];
}

export interface OutletWeekBars {
  id: string;
  name: string;
  current: WeekBar;
  previous: WeekBar;
}

export interface WeekAttention {
  swatches: TopicSwatch[];
  outlets: OutletWeekBars[];
  peak: number;
}

function sum(counts: readonly TopicCount[]): number {
  return counts.reduce((total, count) => total + count.articleCount, 0);
}

function buildBar(counts: readonly TopicCount[], swatches: readonly TopicSwatch[]): WeekBar {
  const byTopic = new Map(counts.map((count) => [count.topicKey, count.articleCount]));
  const named = swatches.filter((swatch) => swatch.key !== "other");
  const namedKeys = new Set(named.map((swatch) => swatch.key));
  const other = sum(counts.filter((count) => !namedKeys.has(count.topicKey)));
  const otherSwatch = swatches.find((swatch) => swatch.key === "other");
  const segments = [
    ...named.map((swatch) => ({ ...swatch, articleCount: byTopic.get(swatch.key) ?? 0 })),
    ...(otherSwatch ? [{ ...otherSwatch, articleCount: other }] : []),
  ];

  return {
    total: sum(counts),
    segments: segments.filter((segment) => segment.articleCount > 0),
  };
}

export function weekAttention(tracker: CoverageTracker): WeekAttention {
  const labels = new Map(tracker.topics.map((topic) => [topic.key, topic.label]));
  const totals = new Map<string, number>();

  for (const outlet of tracker.thisWeek.outlets) {
    for (const count of [...outlet.current, ...outlet.previous]) {
      totals.set(count.topicKey, (totals.get(count.topicKey) ?? 0) + count.articleCount);
    }
  }

  const ranked = [...totals]
    .sort((left, right) => right[1] - left[1])
    .map(([key]) => ({ key, label: labels.get(key) ?? key }));
  const swatches = topicSwatches(ranked, ranked.length > TOPIC_SERIES_COLOURS.length);
  const outlets = [...tracker.thisWeek.outlets]
    .sort((left, right) => sum(right.current) - sum(left.current))
    .slice(0, OUTLET_LIMIT)
    .map((outlet) => ({
      id: outlet.id,
      name: outlet.name,
      current: buildBar(outlet.current, swatches),
      previous: buildBar(outlet.previous, swatches),
    }));
  const peak = Math.max(
    1,
    ...outlets.flatMap((outlet) => [outlet.current.total, outlet.previous.total]),
  );

  return { swatches, outlets, peak };
}

export function hasWeekCoverage(tracker: CoverageTracker): boolean {
  return (
    tracker.thisWeek.outlets.some((outlet) => outlet.current.length > 0) ||
    tracker.thisWeek.names.length > 0 ||
    tracker.droppedOff.length > 0
  );
}

export function sortedWeekNames(tracker: CoverageTracker): ThisWeek["names"] {
  return [...tracker.thisWeek.names].sort((left, right) =>
    left.trend === right.trend
      ? Math.abs(right.current - right.previous) - Math.abs(left.current - left.previous)
      : left.trend === "rising"
        ? -1
        : 1,
  );
}
