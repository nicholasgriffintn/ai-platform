import { getModels } from "@ngriffin_uk/polychat-ai-models";
import {
  getBenchmark,
  listBenchmarks,
  rankBySignificance,
  type Benchmark,
} from "@ngriffin_uk/polychat-library-benchmarks";
import { summariseScores } from "@ngriffin_uk/polychat-library-model-registry";
import {
  benchmarkIdSchema,
  formatBenchmarkStanding,
  type BenchmarkArtificialAnalysis,
  type BenchmarkBoard,
  type BenchmarkId,
  type BenchmarkIndex,
  type BenchmarkMedal,
  type BenchmarkRunDetail,
  type BenchmarkStanding,
  type ModelBenchmarkStanding,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import type { IEnv } from "~/types";

import { BenchmarkResultStore } from "../infrastructure/BenchmarkResultStore";
import type { BenchmarkRunRecord } from "../infrastructure/BenchmarkRunRepository";
import { toBenchmarkRun } from "./mappers";

type BoardStanding = Omit<BenchmarkStanding, "rank" | "tied">;

function isCurrent(record: BenchmarkRunRecord): boolean {
  const parsed = benchmarkIdSchema.safeParse(record.benchmark_id);

  return parsed.success && getBenchmark(parsed.data).summary.version === record.version;
}

function latestPerEntrant(records: readonly BenchmarkRunRecord[]): BenchmarkRunRecord[] {
  const latest = new Map<string, BenchmarkRunRecord>();

  for (const record of records) {
    const key = `${record.benchmark_id}:${record.entrant_key}`;
    const existing = latest.get(key);

    if (!existing || (record.completed_at ?? "") > (existing.completed_at ?? "")) {
      latest.set(key, record);
    }
  }

  return [...latest.values()];
}

function artificialAnalysisFor(record: BenchmarkRunRecord): BenchmarkArtificialAnalysis | null {
  if (record.entrant.kind !== "model") {
    return null;
  }

  const analysis = getModels()[record.entrant.modelId]?.artificialAnalysis;

  return analysis
    ? {
        intelligenceIndex: analysis.intelligenceIndex ?? null,
        codingIndex: analysis.codingIndex ?? null,
        agenticIndex: analysis.agenticIndex ?? null,
      }
    : null;
}

function toStanding(record: BenchmarkRunRecord): BoardStanding {
  return {
    runId: record.id,
    entrant: record.entrant,
    score: record.score ?? null,
    rating: record.rating ?? null,
    metrics: record.metrics,
    costPerItemUsd:
      record.cost_usd === null || record.items_total === 0
        ? null
        : record.cost_usd / record.items_total,
    latencyP50Ms: record.latency_p50_ms ?? null,
    artificialAnalysis: artificialAnalysisFor(record),
  };
}

function rankStandings(benchmark: Benchmark, standings: BoardStanding[]): BenchmarkStanding[] {
  const useRatings =
    benchmark.summary.scoring === "votes" && standings.some((standing) => standing.rating);

  return rankBySignificance(standings, (standing) => {
    if (useRatings) {
      return standing.rating
        ? {
            value: standing.rating.rating,
            low: standing.rating.winRate.low,
            high: standing.rating.winRate.high,
          }
        : null;
    }

    return standing.score
      ? { value: standing.score.mean, low: standing.score.low, high: standing.score.high }
      : null;
  }).map(({ entry, rank, tied }) => ({ ...entry, rank, tied }));
}

function humanStanding(records: readonly BenchmarkRunRecord[]): BenchmarkStanding | null {
  const means = records.flatMap((record) => (record.score ? [record.score.mean] : []));

  if (means.length === 0) {
    return null;
  }

  return {
    rank: 1,
    tied: false,
    runId: "humans",
    entrant: { kind: "human", name: `People (${means.length} games)` },
    score: summariseScores(means),
    rating: null,
    metrics: {},
    costPerItemUsd: null,
    latencyP50Ms: null,
    artificialAnalysis: null,
  };
}

export async function listOfficialRuns(
  repositories: RepositoryManager,
  benchmarkId?: BenchmarkId,
): Promise<BenchmarkRunRecord[]> {
  return latestPerEntrant(
    (await repositories.benchmarkRuns.listCompletedBoardRuns("official")).filter(
      (record) => isCurrent(record) && (!benchmarkId || record.benchmark_id === benchmarkId),
    ),
  );
}

export async function buildBoards(
  repositories: RepositoryManager,
  options: { includeHuman: boolean },
): Promise<BenchmarkBoard[]> {
  const official = await listOfficialRuns(repositories);
  const human = options.includeHuman
    ? (await repositories.benchmarkRuns.listCompletedBoardRuns("human")).filter(isCurrent)
    : [];

  return listBenchmarks().map((benchmark) => ({
    benchmark: benchmark.summary,
    standings: rankStandings(
      benchmark,
      official.filter((record) => record.benchmark_id === benchmark.summary.id).map(toStanding),
    ),
    human: humanStanding(human.filter((record) => record.benchmark_id === benchmark.summary.id)),
  }));
}

function medalTable(boards: readonly BenchmarkBoard[]): BenchmarkMedal[] {
  const medals = new Map<string, BenchmarkMedal>();

  for (const board of boards) {
    for (const standing of board.standings) {
      if (standing.rank > 3) {
        continue;
      }

      const key = standing.entrant.kind === "model" ? standing.entrant.modelId : standing.runId;
      const medal = medals.get(key) ?? {
        entrant: standing.entrant,
        gold: 0,
        silver: 0,
        bronze: 0,
      };

      if (standing.rank === 1) {
        medal.gold += 1;
      } else if (standing.rank === 2) {
        medal.silver += 1;
      } else {
        medal.bronze += 1;
      }

      medals.set(key, medal);
    }
  }

  return [...medals.values()].sort(
    (left, right) =>
      right.gold - left.gold || right.silver - left.silver || right.bronze - left.bronze,
  );
}

export async function getBenchmarkIndex(repositories: RepositoryManager): Promise<BenchmarkIndex> {
  const boards = await buildBoards(repositories, { includeHuman: true });

  return { boards, medals: medalTable(boards) };
}

export async function getBenchmarkBoard(
  repositories: RepositoryManager,
  benchmarkId: BenchmarkId,
): Promise<BenchmarkBoard> {
  const boards = await buildBoards(repositories, { includeHuman: true });
  const board = boards.find((candidate) => candidate.benchmark.id === benchmarkId);

  if (!board) {
    throw new AssistantError("Benchmark not found", ErrorType.NOT_FOUND, 404);
  }

  return board;
}

function officialPosition(board: BenchmarkBoard, record: BenchmarkRunRecord) {
  const mean = record.score?.mean;
  const scored = board.standings.filter(
    (standing) => standing.score && standing.runId !== record.id,
  );

  return {
    officialRank:
      mean === undefined
        ? null
        : 1 + scored.filter((standing) => (standing.score?.mean ?? 0) > mean).length,
    officialCount: scored.length,
  };
}

export async function buildRunDetail(
  env: IEnv,
  repositories: RepositoryManager,
  record: BenchmarkRunRecord,
  options: { includeShareToken?: boolean } = {},
): Promise<BenchmarkRunDetail> {
  const benchmark = getBenchmark(benchmarkIdSchema.parse(record.benchmark_id));
  const results = new Map(
    (await BenchmarkResultStore.forEnv(env).readResults(record.id)).map((result) => [
      result.itemId,
      result,
    ]),
  );
  const itemIds =
    record.scope === "human" ? [...results.keys()].filter(benchmark.hasItem) : benchmark.itemIds;
  const board = await getBenchmarkBoard(repositories, benchmark.summary.id);

  return {
    benchmark: benchmark.summary,
    run: toBenchmarkRun(record, options),
    items: itemIds.map((itemId) => ({
      item: benchmark.publicItem(itemId),
      reveal: benchmark.reveal(itemId),
      result: results.get(itemId) ?? null,
    })),
    ...officialPosition(board, record),
  };
}

export async function getEntrantDetail(
  env: IEnv,
  repositories: RepositoryManager,
  benchmarkId: BenchmarkId,
  modelId: string,
): Promise<BenchmarkRunDetail> {
  const record = (await listOfficialRuns(repositories, benchmarkId)).find(
    (candidate) => candidate.entrant_key === `model:${modelId}`,
  );

  if (!record) {
    throw new AssistantError("This model has not run this benchmark yet", ErrorType.NOT_FOUND, 404);
  }

  return buildRunDetail(env, repositories, record);
}

function standingRatio(standing: BenchmarkStanding): number {
  return standing.rating ? standing.rating.winRate.mean : (standing.score?.mean ?? 0);
}

export async function listModelBenchmarkStandings(
  repositories: RepositoryManager,
  userId?: number,
): Promise<Map<string, ModelBenchmarkStanding[]>> {
  const boards = await buildBoards(repositories, { includeHuman: false });
  const byModel = new Map<string, ModelBenchmarkStanding[]>();
  const push = (modelId: string, standing: ModelBenchmarkStanding) => {
    byModel.set(modelId, [...(byModel.get(modelId) ?? []), standing]);
  };

  for (const board of boards) {
    for (const standing of board.standings) {
      if (standing.entrant.kind === "model") {
        push(standing.entrant.modelId, {
          benchmarkId: board.benchmark.id,
          name: board.benchmark.name,
          rank: standing.rank,
          of: board.standings.length,
          display: formatBenchmarkStanding(board.benchmark, standing),
          ratio: standingRatio(standing),
          personal: false,
        });
      }
    }
  }

  if (!userId) {
    return byModel;
  }

  for (const record of latestPerEntrant(
    (await repositories.benchmarkRuns.listCompletedPersonal(userId)).filter(isCurrent),
  )) {
    const board = boards.find((candidate) => candidate.benchmark.id === record.benchmark_id);

    if (record.entrant.kind !== "model" || !board || !record.score) {
      continue;
    }

    const modelId = record.entrant.modelId;

    if (byModel.get(modelId)?.some((standing) => standing.benchmarkId === board.benchmark.id)) {
      continue;
    }

    push(modelId, {
      benchmarkId: board.benchmark.id,
      name: board.benchmark.name,
      rank: officialPosition(board, record).officialRank,
      of: board.standings.length,
      display: formatBenchmarkStanding(board.benchmark, {
        score: record.score,
        rating: null,
      }),
      ratio: record.score.mean,
      personal: true,
    });
  }

  return byModel;
}
