import { shiftCalendarDate, startOfIsoWeek } from "@ngriffin_uk/polychat-utility-core";

import {
  COVERAGE_WINDOW_DAYS,
  type CoverageRow,
  type StoryCoverageWindow,
  type TermRow,
} from "./coverage";

const HEATMAP_DAYS = 28;
const HEATMAP_OUTLET_LIMIT = 12;
const HEATMAP_TOPIC_LIMIT = 8;
const TERM_LIMIT = 8;
const WEEK_OUTLET_LIMIT = 8;
const WEEK_NAME_LIMIT = 6;
const SPARK_DAYS = 14;

export interface TopicCount {
  topicKey: string;
  articleCount: number;
}

export interface TrackerModel {
  until: string;
  weeks: string[];
  topicKeys: string[];
  topicShare: Array<TopicCount & { week: string; share: number }>;
  heatmap: {
    outlets: Array<{ id: string; name: string; articleCount: number }>;
    cells: Array<TopicCount & { outletId: string; share: number }>;
  };
  storyWindows: StoryCoverageWindow[];
  terms: Array<{
    key: string;
    term: string;
    total: number;
    weeks: Array<{ week: string; articleCount: number }>;
  }>;
  thisWeek: {
    since: string;
    outlets: Array<{
      id: string;
      name: string;
      current: TopicCount[];
      previous: TopicCount[];
    }>;
    names: Array<{
      key: string;
      term: string;
      current: number;
      previous: number;
      trend: "rising" | "fading";
      days: number[];
    }>;
    leadStoryId: string | null;
  };
}

function share(part: number, total: number): number {
  return total > 0 ? Math.min(1, part / total) : 0;
}

function add<TKey>(map: Map<TKey, number>, key: TKey, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

function byCountDesc<T extends { articleCount: number }>(left: T, right: T): number {
  return right.articleCount - left.articleCount;
}

function listWeeks(since: string, until: string): string[] {
  const weeks: string[] = [];

  for (let week = startOfIsoWeek(since); week <= until; week = shiftCalendarDate(week, 7)) {
    weeks.push(week);
  }

  return weeks;
}

function countTopics(rows: readonly CoverageRow[]): TopicCount[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    add(counts, row.subjectKey, row.articleCount);
  }

  return [...counts]
    .map(([topicKey, articleCount]) => ({ topicKey, articleCount }))
    .sort(byCountDesc);
}

function buildHeatmap(rows: readonly CoverageRow[], topicKeys: readonly string[]) {
  const outlets = new Map<string, { id: string; name: string; articleCount: number }>();

  for (const row of rows) {
    const outlet = outlets.get(row.outletId) ?? {
      id: row.outletId,
      name: row.outletName,
      articleCount: 0,
    };

    outlet.articleCount += row.articleCount;
    outlets.set(row.outletId, outlet);
  }

  const shown = [...outlets.values()]
    .sort((left, right) => byCountDesc(left, right) || left.name.localeCompare(right.name))
    .slice(0, HEATMAP_OUTLET_LIMIT);
  const shownIds = new Map(shown.map((outlet) => [outlet.id, outlet]));
  const topics = new Set(topicKeys.slice(0, HEATMAP_TOPIC_LIMIT));
  const cells = new Map<string, TopicCount & { outletId: string }>();

  for (const row of rows) {
    if (!shownIds.has(row.outletId) || !topics.has(row.subjectKey)) {
      continue;
    }

    const key = `${row.outletId}\u0000${row.subjectKey}`;
    const cell = cells.get(key) ?? {
      outletId: row.outletId,
      topicKey: row.subjectKey,
      articleCount: 0,
    };

    cell.articleCount += row.articleCount;
    cells.set(key, cell);
  }

  return {
    outlets: shown,
    cells: [...cells.values()].map((cell) => ({
      ...cell,
      share: share(cell.articleCount, shownIds.get(cell.outletId)?.articleCount ?? 0),
    })),
  };
}

function buildWeekOutlets(
  topicRows: readonly CoverageRow[],
  currentSince: string,
  previousSince: string,
) {
  const outlets = new Map<
    string,
    { id: string; name: string; current: CoverageRow[]; previous: CoverageRow[] }
  >();

  for (const row of topicRows) {
    if (row.day < previousSince) {
      continue;
    }

    const outlet = outlets.get(row.outletId) ?? {
      id: row.outletId,
      name: row.outletName,
      current: [],
      previous: [],
    };

    (row.day >= currentSince ? outlet.current : outlet.previous).push(row);
    outlets.set(row.outletId, outlet);
  }

  return [...outlets.values()]
    .map((outlet) => ({
      id: outlet.id,
      name: outlet.name,
      current: countTopics(outlet.current),
      previous: countTopics(outlet.previous),
    }))
    .filter((outlet) => outlet.current.length > 0 || outlet.previous.length > 0)
    .sort(
      (left, right) =>
        right.current.reduce((sum, entry) => sum + entry.articleCount, 0) -
        left.current.reduce((sum, entry) => sum + entry.articleCount, 0),
    )
    .slice(0, WEEK_OUTLET_LIMIT);
}

function buildWeekNames(
  entityRows: readonly TermRow[],
  until: string,
  currentSince: string,
  previousSince: string,
) {
  const sparkSince = shiftCalendarDate(until, 1 - SPARK_DAYS);
  const names = new Map<
    string,
    { key: string; term: string; current: number; previous: number; days: Map<string, number> }
  >();

  for (const row of entityRows) {
    if (row.day < previousSince) {
      continue;
    }

    const name = names.get(row.termKey) ?? {
      key: row.termKey,
      term: row.term,
      current: 0,
      previous: 0,
      days: new Map<string, number>(),
    };

    name[row.day >= currentSince ? "current" : "previous"] += row.articleCount;

    if (row.day >= sparkSince) {
      add(name.days, row.day, row.articleCount);
    }

    names.set(row.termKey, name);
  }

  const days = Array.from({ length: SPARK_DAYS }, (_, index) =>
    shiftCalendarDate(sparkSince, index),
  );
  const ranked = [...names.values()].map((name) => ({
    key: name.key,
    term: name.term,
    current: name.current,
    previous: name.previous,
    days: days.map((day) => name.days.get(day) ?? 0),
  }));
  const rising = ranked
    .filter((name) => name.current > name.previous)
    .sort((left, right) => right.current - right.previous - (left.current - left.previous))
    .slice(0, WEEK_NAME_LIMIT / 2)
    .map((name) => ({ ...name, trend: "rising" as const }));
  const fading = ranked
    .filter((name) => name.previous > name.current)
    .sort((left, right) => right.previous - right.current - (left.previous - left.current))
    .slice(0, WEEK_NAME_LIMIT / 2)
    .map((name) => ({ ...name, trend: "fading" as const }));

  return [...rising, ...fading];
}

export function buildTrackerModel(input: {
  coverage: readonly CoverageRow[];
  terms: readonly TermRow[];
  until: string;
  weeks: number;
}): TrackerModel {
  const { until } = input;
  const windowStart = startOfIsoWeek(shiftCalendarDate(until, -7 * (input.weeks - 1)));
  const firstDay = input.coverage.map((row) => row.day).sort()[0];
  const since =
    firstDay && startOfIsoWeek(firstDay) > windowStart ? startOfIsoWeek(firstDay) : windowStart;
  const currentSince = shiftCalendarDate(until, 1 - COVERAGE_WINDOW_DAYS);
  const previousSince = shiftCalendarDate(currentSince, -COVERAGE_WINDOW_DAYS);
  const heatmapSince = shiftCalendarDate(until, 1 - HEATMAP_DAYS);
  const inWindow = input.coverage.filter((row) => row.day >= since && row.day <= until);
  const topicRows = inWindow.filter((row) => row.subjectKind === "topic");
  const storyRows = inWindow.filter((row) => row.subjectKind === "story");
  const weekTopics = new Map<string, Map<string, number>>();

  for (const row of topicRows) {
    const week = startOfIsoWeek(row.day);
    const counts = weekTopics.get(week) ?? new Map<string, number>();

    add(counts, row.subjectKey, row.articleCount);
    weekTopics.set(week, counts);
  }

  const topicKeys = countTopics(topicRows).map((entry) => entry.topicKey);
  const topicShare = [...weekTopics].flatMap(([week, counts]) => {
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);

    return [...counts].map(([topicKey, articleCount]) => ({
      week,
      topicKey,
      articleCount,
      share: share(articleCount, total),
    }));
  });
  const windows = new Map<string, StoryCoverageWindow>();

  for (const row of storyRows) {
    if (row.day < previousSince) {
      continue;
    }

    const window = windows.get(row.subjectKey) ?? {
      storyId: row.subjectKey,
      previous: 0,
      current: 0,
    };

    window[row.day >= currentSince ? "current" : "previous"] += row.articleCount;
    windows.set(row.subjectKey, window);
  }

  const entityRows = input.terms.filter(
    (row) => row.termKind === "entity" && row.day >= since && row.day <= until,
  );
  const termTotals = new Map<string, { term: string; total: number; weeks: Map<string, number> }>();

  for (const row of entityRows) {
    const term = termTotals.get(row.termKey) ?? { term: row.term, total: 0, weeks: new Map() };

    term.total += row.articleCount;
    add(term.weeks, startOfIsoWeek(row.day), row.articleCount);
    termTotals.set(row.termKey, term);
  }

  const lead = [...windows.values()].sort((left, right) => right.current - left.current)[0];

  return {
    until,
    weeks: listWeeks(since, until),
    topicKeys,
    topicShare,
    heatmap: buildHeatmap(
      topicRows.filter((row) => row.day >= heatmapSince),
      topicKeys,
    ),
    storyWindows: [...windows.values()],
    terms: [...termTotals]
      .sort((left, right) => right[1].total - left[1].total)
      .slice(0, TERM_LIMIT)
      .map(([key, term]) => ({
        key,
        term: term.term,
        total: term.total,
        weeks: [...term.weeks].map(([week, articleCount]) => ({ week, articleCount })),
      })),
    thisWeek: {
      since: currentSince,
      outlets: buildWeekOutlets(topicRows, currentSince, previousSince),
      names: buildWeekNames(entityRows, until, currentSince, previousSince),
      leadStoryId: lead && lead.current > 0 ? lead.storyId : null,
    },
  };
}
