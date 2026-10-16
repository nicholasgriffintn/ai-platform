import { getModels } from "@ngriffin_uk/polychat-ai-models";
import {
  getBenchmark,
  listBenchmarks,
  type Benchmark,
} from "@ngriffin_uk/polychat-library-benchmarks";
import {
  MODEL_TIER_LINEUP,
  benchmarkEntrantKey,
  benchmarkIdSchema,
  findModelByReference,
  getModelDisplayName,
  isActiveModel,
  isLineupEligibleModel,
  type BenchmarkEntrant,
  type BenchmarkOfficialBoard,
  type BenchmarkOfficialEntrant,
  type BenchmarkOfficialOverview,
  type BenchmarkRun,
  type ModelConfigItem,
  type QueueOfficialBenchmarkRunsRequest,
} from "@ngriffin_uk/polychat-schemas";

import { BENCHMARKS_CONFIG } from "~/config/benchmarks";
import type { Repositories } from "~/infrastructure/database/repositories";
import { BenchmarkRunRepository } from "~/modules/benchmarks/infrastructure/BenchmarkRunRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { IEnv, IUser } from "~/types";

import type { BenchmarkRunRecord } from "../infrastructure/BenchmarkRunRepository";
import {
  credentialSourceFor,
  findOfficialModel,
  isDecisionModel,
  isOfficialLabModel,
  listOfficialModels,
  modelIneligibility,
  officialEntrant,
  type OfficialModel,
  type OfficialModels,
} from "./entrants";
import { toBenchmarkRun } from "./mappers";
import { enqueueBenchmarkRunTask } from "./runner";

export interface OfficialQueueResult {
  queued: BenchmarkRun[];
  skippedForBudget: boolean;
  spentThisMonthUsd: number;
  remaining: number;
}

export interface OfficialQueueOptions {
  ownerUserId?: number | null;
}

function startOfMonth(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

const DAY_MS = 24 * 60 * 60 * 1000;

function releasedSince(config: ModelConfigItem, since: number): boolean {
  const released = config.releaseDate ? Date.parse(config.releaseDate) : Number.NaN;

  return Number.isFinite(released) && released >= since;
}

export function officialCandidateModelIds(catalogue = getModels(), now = Date.now()): string[] {
  const lineup = Object.values(MODEL_TIER_LINEUP.hosted).flatMap((roles) =>
    Object.values(roles).flatMap((candidates) => [...candidates]),
  );
  const fromLineup = new Set(
    lineup.flatMap((candidate) => {
      const resolved = findModelByReference(catalogue, candidate);

      return resolved ? [resolved.id] : [];
    }),
  );
  const since = now - BENCHMARKS_CONFIG.recentReleaseDays * DAY_MS;

  return Object.entries(catalogue)
    .filter(([id, config]) => {
      if (!isOfficialLabModel(config) || !isActiveModel(config)) {
        return false;
      }

      if (isDecisionModel(config)) {
        return true;
      }

      return (
        isLineupEligibleModel(config) &&
        (fromLineup.has(id) || config.isFeatured === true || releasedSince(config, since))
      );
    })
    .map(([id]) => id);
}

export function officialEntrantsFor(
  models: OfficialModels,
  benchmark: Benchmark,
  modelIds: readonly string[],
  existing: ReadonlySet<string>,
): BenchmarkEntrant[] {
  return modelIds.flatMap((modelId) => {
    const official = findOfficialModel(models, modelId);

    if (!official || modelIneligibility(benchmark, official.runsOn)) {
      return [];
    }

    const entrant = officialEntrant(official);

    return existing.has(benchmarkEntrantKey(entrant)) ? [] : [entrant];
  });
}

async function loadOwner(
  repositories: Repositories,
  ownerUserId: number | null | undefined,
): Promise<IUser | null> {
  return ownerUserId ? repositories.get(UserRepository).getUserById(ownerUserId) : null;
}

export async function queueOfficialRuns(
  env: IEnv,
  repositories: Repositories,
  request: QueueOfficialBenchmarkRunsRequest = {},
  options: OfficialQueueOptions = {},
  now = new Date(),
): Promise<OfficialQueueResult> {
  const spentThisMonthUsd = await repositories
    .get(BenchmarkRunRepository)
    .officialSpendSince(startOfMonth(now));

  if (spentThisMonthUsd >= BENCHMARKS_CONFIG.officialMonthlyBudgetUsd) {
    return { queued: [], skippedForBudget: true, spentThisMonthUsd, remaining: 0 };
  }

  const owner = await loadOwner(repositories, options.ownerUserId);
  const models = await listOfficialModels(env, owner);
  const explicit = Boolean(request.modelIds?.length);
  const benchmarks = request.benchmarkIds?.length
    ? request.benchmarkIds.map(getBenchmark)
    : listBenchmarks();
  const modelIds = explicit ? (request.modelIds ?? []) : officialCandidateModelIds();
  const limit = explicit ? Number.POSITIVE_INFINITY : BENCHMARKS_CONFIG.officialRunsPerQueuePass;
  const wanted: { benchmark: Benchmark; entrant: BenchmarkEntrant }[] = [];

  for (const benchmark of benchmarks) {
    const existing = await repositories
      .get(BenchmarkRunRepository)
      .listOfficialEntrantKeys(benchmark.summary.id, benchmark.summary.version, {
        retryFailed: request.retryFailed ?? explicit,
      });

    for (const entrant of officialEntrantsFor(models, benchmark, modelIds, existing)) {
      wanted.push({ benchmark, entrant });
    }
  }

  const queued: BenchmarkRun[] = [];

  for (const { benchmark, entrant } of wanted.slice(0, limit)) {
    const record = await repositories.get(BenchmarkRunRepository).create({
      benchmarkId: benchmark.summary.id,
      version: benchmark.summary.version,
      scope: "official",
      entrant,
      ownerUserId: owner?.id ?? null,
      workspaceId: null,
      status: "queued",
      visibility: "public",
      itemsTotal: benchmark.summary.itemCount,
    });

    await enqueueBenchmarkRunTask(env, repositories, record.id, { kind: "start" });
    queued.push(toBenchmarkRun(record));
  }

  return {
    queued,
    skippedForBudget: false,
    spentThisMonthUsd,
    remaining: wanted.length - queued.length,
  };
}

export async function recoverStaleBenchmarkRuns(
  env: IEnv,
  repositories: Repositories,
): Promise<number> {
  const stale = await repositories
    .get(BenchmarkRunRepository)
    .listStaleRunning(BENCHMARKS_CONFIG.staleRunMinutes);

  let recovered = 0;

  for (const run of stale) {
    if (
      await enqueueBenchmarkRunTask(env, repositories, run.id, {
        kind: "sweep",
        itemsTotal: run.items_total,
      })
    ) {
      recovered += 1;
    }
  }

  return recovered;
}

function latestOfficialRuns(
  records: readonly BenchmarkRunRecord[],
): Map<string, BenchmarkRunRecord> {
  const latest = new Map<string, BenchmarkRunRecord>();

  for (const record of records) {
    const parsed = benchmarkIdSchema.safeParse(record.benchmark_id);

    if (!parsed.success || getBenchmark(parsed.data).summary.version !== record.version) {
      continue;
    }

    const key = `${record.benchmark_id}:${record.entrant_key}`;

    if (!latest.has(key)) {
      latest.set(key, record);
    }
  }

  return latest;
}

function describeEntrant(
  benchmark: Benchmark,
  modelId: string,
  official: OfficialModel | null,
  catalogued: ModelConfigItem | undefined,
  record: BenchmarkRunRecord | undefined,
): BenchmarkOfficialEntrant {
  const known = official?.config ?? catalogued;
  const run = record ? toBenchmarkRun(record) : null;
  const base = {
    modelId,
    name: known ? getModelDisplayName(known) : (run?.entrant.name ?? modelId),
    provider: known?.provider ?? (run?.entrant.kind === "model" ? run.entrant.provider : "unknown"),
    credential: official ? credentialSourceFor(official) : null,
    run,
  };

  if (run && run.status !== "cancelled") {
    return { ...base, status: run.status, reason: run.failureReason };
  }

  if (!official) {
    return {
      ...base,
      status: "unavailable",
      reason: catalogued
        ? `No ${base.provider} key and no Workers AI mirror: add your own or set the platform key`
        : "This model is no longer in the catalogue",
    };
  }

  const ineligibility = modelIneligibility(benchmark, official.runsOn);

  if (ineligibility) {
    return { ...base, status: "ineligible", reason: ineligibility };
  }

  return run
    ? { ...base, status: "cancelled", reason: run.failureReason }
    : { ...base, status: "missing", reason: null };
}

function compareEntrants(left: BenchmarkOfficialEntrant, right: BenchmarkOfficialEntrant): number {
  return left.provider.localeCompare(right.provider) || left.name.localeCompare(right.name);
}

export async function getOfficialOverview(
  env: IEnv,
  repositories: Repositories,
  user: IUser,
): Promise<BenchmarkOfficialOverview> {
  const models = await listOfficialModels(env, user);
  const catalogue = getModels();
  const latest = latestOfficialRuns(await repositories.get(BenchmarkRunRepository).listOfficial());
  const ranModelIds = [...latest.values()].flatMap((record) =>
    record.entrant.kind === "model" ? [record.entrant.modelId] : [],
  );
  const modelIds = [...new Set([...officialCandidateModelIds(catalogue), ...ranModelIds])];
  const now = new Date();
  const boards: BenchmarkOfficialBoard[] = listBenchmarks().map((benchmark) => ({
    benchmark: benchmark.summary,
    entrants: modelIds
      .map((modelId) =>
        describeEntrant(
          benchmark,
          modelId,
          findOfficialModel(models, modelId),
          catalogue[modelId],
          latest.get(`${benchmark.summary.id}:model:${modelId}`),
        ),
      )
      .sort(compareEntrants),
  }));

  return {
    budget: {
      monthlyUsd: BENCHMARKS_CONFIG.officialMonthlyBudgetUsd,
      spentThisMonthUsd: await repositories
        .get(BenchmarkRunRepository)
        .officialSpendSince(startOfMonth(now)),
    },
    boards,
  };
}
