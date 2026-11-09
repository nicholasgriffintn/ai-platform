import type { CoverageTracker } from "@ngriffin_uk/polychat-schemas";
import {
  shiftCalendarDate,
  startOfIsoWeek,
  utcCalendarDate,
} from "@ngriffin_uk/polychat-utility-core";

import { discoverNewsTopicLabel } from "~/modules/discover/domain/news-categories";
import {
  listDroppedOff,
  rollUpCoverageDay,
  rollupDays,
  type CoverageRow,
  type TermRow,
} from "~/modules/stories/domain/coverage";
import { buildTrackerModel } from "~/modules/stories/domain/tracker";
import { CoverageRepository } from "~/modules/stories/infrastructure/CoverageRepository";
import { StoryRepository } from "~/modules/stories/infrastructure/StoryRepository";
import type { IEnv } from "~/types";

import { presentStorySummary } from "./read-models";

const DROPPED_LIMIT = 10;

export interface CoverageRollupOutcome {
  days: number;
  coverageRows: number;
  termRows: number;
}

async function rollUpDay(repository: CoverageRepository, day: string) {
  const facts = await repository.listFactsForDay(day);
  const mentions = await repository.listMentions(facts.map((fact) => fact.storyId));

  return rollUpCoverageDay(day, facts, mentions);
}

export async function rollUpStoryCoverage(
  env: IEnv,
  now = new Date(),
): Promise<CoverageRollupOutcome> {
  const repository = new CoverageRepository(env);
  const outcome: CoverageRollupOutcome = { days: 0, coverageRows: 0, termRows: 0 };

  for (const day of rollupDays(now)) {
    const rollup = await rollUpDay(repository, day);

    await repository.replaceDay(day, rollup.coverage, rollup.terms);
    outcome.days += 1;
    outcome.coverageRows += rollup.coverage.length;
    outcome.termRows += rollup.terms.length;
  }

  return outcome;
}

function listDays(since: string, until: string): string[] {
  const days: string[] = [];

  for (let day = since; day <= until; day = shiftCalendarDate(day, 1)) {
    days.push(day);
  }

  return days;
}

async function readCoverageRows(
  repository: CoverageRepository,
  since: string,
  today: string,
): Promise<{ coverage: CoverageRow[]; terms: TermRow[] }> {
  const [stored, storedTerms, range, firstFact] = await Promise.all([
    repository.listCoverageRows(since, today),
    repository.listTermRows(since, today),
    repository.listDayRange(),
    repository.firstFactDay(),
  ]);
  const liveSince = [range.last ?? firstFact, since]
    .filter((day): day is string => Boolean(day))
    .sort()
    .at(-1);

  if (!liveSince) {
    return { coverage: stored, terms: storedTerms };
  }

  const live = await Promise.all(
    listDays(liveSince, today).map((day) => rollUpDay(repository, day)),
  );

  return {
    coverage: [
      ...stored.filter((row) => row.day < liveSince),
      ...live.flatMap((day) => day.coverage),
    ],
    terms: [
      ...storedTerms.filter((row) => row.day < liveSince),
      ...live.flatMap((day) => day.terms),
    ],
  };
}

export async function readCoverageTracker(
  env: IEnv,
  input: { weeks: number },
  now = new Date(),
): Promise<CoverageTracker> {
  const repository = new CoverageRepository(env);
  const today = utcCalendarDate(now);
  const since = startOfIsoWeek(shiftCalendarDate(today, -7 * (input.weeks - 1)));
  const rows = await readCoverageRows(repository, since, today);
  const model = buildTrackerModel({ ...rows, until: today, weeks: input.weeks });
  const stories = new Map(
    (
      await new StoryRepository(env).listByIds(model.storyWindows.map((window) => window.storyId))
    ).map((story) => [story.id, story]),
  );
  const dropped = listDroppedOff(
    model.storyWindows.filter((window) => stories.get(window.storyId)?.status === "open"),
  ).slice(0, DROPPED_LIMIT);
  const lead = model.thisWeek.leadStoryId ? stories.get(model.thisWeek.leadStoryId) : undefined;
  const leadWindow = model.storyWindows.find((window) => window.storyId === lead?.id);

  return {
    until: rows.coverage.length > 0 ? today : null,
    weeks: model.weeks,
    topics: model.topicKeys.map((key) => ({ key, label: discoverNewsTopicLabel(key) })),
    topicShare: model.topicShare,
    heatmap: model.heatmap,
    droppedOff: dropped.flatMap((entry) => {
      const story = stories.get(entry.storyId);

      return story
        ? [{ story: presentStorySummary(story), previous: entry.previous, current: entry.current }]
        : [];
    }),
    terms: model.terms,
    thisWeek: {
      since: model.thisWeek.since,
      outlets: model.thisWeek.outlets,
      names: model.thisWeek.names,
      lead:
        lead && leadWindow
          ? { story: presentStorySummary(lead), articleCount: leadWindow.current }
          : null,
    },
  };
}
