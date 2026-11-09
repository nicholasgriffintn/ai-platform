import { shiftCalendarDate, utcCalendarDate } from "@ngriffin_uk/polychat-utility-core";

export const COVERAGE_ROLLUP_DAYS = 7;
export const COVERAGE_WINDOW_DAYS = 7;
const DROPPED_MIN_PREVIOUS = 3;
const DROPPED_SHARE = 0.5;

export interface CoverageFact {
  storyId: string;
  outletId: string;
  outletName: string;
  topicKey: string | null;
  isLead: boolean;
}

export interface CoverageMention {
  storyId: string;
  entityId: string;
  name: string;
}

export interface CoverageRow {
  day: string;
  subjectKind: "topic" | "story";
  subjectKey: string;
  outletId: string;
  outletName: string;
  articleCount: number;
  leadCount: number;
}

export interface TermRow {
  day: string;
  termKind: "entity" | "topic";
  termKey: string;
  term: string;
  articleCount: number;
  storyCount: number;
}

export interface DayRollup {
  coverage: CoverageRow[];
  terms: TermRow[];
}

export interface StoryCoverageWindow {
  storyId: string;
  previous: number;
  current: number;
}

function addCoverage(
  rows: Map<string, CoverageRow>,
  row: Omit<CoverageRow, "articleCount" | "leadCount">,
  isLead: boolean,
): void {
  const key = `${row.subjectKind}\u0000${row.subjectKey}\u0000${row.outletId}`;
  const existing = rows.get(key) ?? { ...row, articleCount: 0, leadCount: 0 };

  existing.articleCount += 1;
  existing.leadCount += isLead ? 1 : 0;
  rows.set(key, existing);
}

function addTerm(
  terms: Map<string, TermRow & { stories: Set<string> }>,
  row: Pick<TermRow, "day" | "termKind" | "termKey" | "term">,
  storyId: string,
): void {
  const key = `${row.termKind}\u0000${row.termKey}`;
  const existing = terms.get(key) ?? { ...row, articleCount: 0, storyCount: 0, stories: new Set() };

  existing.articleCount += 1;
  existing.stories.add(storyId);
  existing.storyCount = existing.stories.size;
  terms.set(key, existing);
}

export function rollUpCoverageDay(
  day: string,
  facts: readonly CoverageFact[],
  mentions: readonly CoverageMention[],
): DayRollup {
  const coverage = new Map<string, CoverageRow>();
  const terms = new Map<string, TermRow & { stories: Set<string> }>();
  const entitiesByStory = new Map<string, CoverageMention[]>();

  for (const mention of mentions) {
    entitiesByStory.set(mention.storyId, [
      ...(entitiesByStory.get(mention.storyId) ?? []),
      mention,
    ]);
  }

  for (const fact of facts) {
    const outlet = { day, outletId: fact.outletId, outletName: fact.outletName };

    addCoverage(
      coverage,
      { ...outlet, subjectKind: "story", subjectKey: fact.storyId },
      fact.isLead,
    );

    if (fact.topicKey) {
      addCoverage(
        coverage,
        { ...outlet, subjectKind: "topic", subjectKey: fact.topicKey },
        fact.isLead,
      );
      addTerm(
        terms,
        { day, termKind: "topic", termKey: fact.topicKey, term: fact.topicKey },
        fact.storyId,
      );
    }

    for (const entity of entitiesByStory.get(fact.storyId) ?? []) {
      addTerm(
        terms,
        { day, termKind: "entity", termKey: entity.entityId, term: entity.name },
        fact.storyId,
      );
    }
  }

  return {
    coverage: [...coverage.values()],
    terms: [...terms.values()].map(({ stories: _stories, ...row }) => row),
  };
}

export function lostCoverage(window: StoryCoverageWindow): boolean {
  return (
    window.previous >= DROPPED_MIN_PREVIOUS && window.current <= window.previous * DROPPED_SHARE
  );
}

export function listDroppedOff(windows: readonly StoryCoverageWindow[]): StoryCoverageWindow[] {
  return windows
    .filter(lostCoverage)
    .sort(
      (left, right) =>
        right.previous - right.current - (left.previous - left.current) ||
        left.storyId.localeCompare(right.storyId),
    );
}

export function rollupDays(now: Date): string[] {
  const today = utcCalendarDate(now);

  return Array.from({ length: COVERAGE_ROLLUP_DAYS + 1 }, (_, index) =>
    shiftCalendarDate(today, -index),
  );
}
