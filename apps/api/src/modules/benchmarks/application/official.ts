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
  type BenchmarkEntrant,
  type BenchmarkOfficialBoard,
  type BenchmarkOfficialEntrant,
  type BenchmarkOfficialOverview,
  type BenchmarkRun,
  type ModelConfigItem,
  type QueueOfficialBenchmarkRunsRequest,
} from "@ngriffin_uk/polychat-schemas";

import { BENCHMARKS_CONFIG } from "~/config/benchmarks";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import type { IEnv, IUser } from "~/types";

import type { BenchmarkRunRecord } from "../infrastructure/BenchmarkRunRepository";
import {
  credentialSourceFor,
  findOfficialModel,
  isDecisionModel,
  isOfficialProvider,
  listOfficialModels,
  modelEntrant,
  modelIneligibility,
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

export function officialCandidateModelIds(catalogue = getModels()): string[] {
  const lineup = Object.values(MODEL_TIER_LINEUP.hosted).flatMap((roles) =>
    Object.values(roles).flatMap((candidates) => [...candidates]),
  );
  const fromLineup = lineup.flatMap((candidate) => {
    const resolved = findModelByReference(catalogue, candidate);

    return resolved ? [resolved.id] : [];
  });
  const decisionModels = Object.entries(catalogue)
    .filter(([, config]) => isActiveModel(config) && isDecisionModel(config))
    .map(([id]) => id);

  return [...new Set([...fromLineup, ...decisionModels])].filter((id) =>
    isOfficialProvider(catalogue[id]?.provider ?? ""),
  );
}

export function officialEntrantsFor(
  models: OfficialModels,
  benchmark: Benchmark,
  modelIds: readonly string[],
  existing: ReadonlySet<string>,
): BenchmarkEntrant[] {
  return modelIds.flatMap((modelId) => {
    const config = findOfficialModel(models, modelId);

    if (!config || modelIneligibility(benchmark, config)) {
      return [];
    }

    const entrant = modelEntrant(modelId, config);

    return existing.has(benchmarkEntrantKey(entrant)) ? [] : [entrant];
  });
}

async function loadOwner(
  repositories: RepositoryManager,
  ownerUserId: number | null | undefined,
): Promise<IUser | null> {
  return ownerUserId ? repositories.users.getUserById(ownerUserId) : null;
}

export async function queueOfficialRuns(
  env: IEnv,
  repositories: RepositoryManager,
  request: QueueOfficialBenchmarkRunsRequest = {},
  options: OfficialQueueOptions = {},
  now = new Date(),
): Promise<OfficialQueueResult> {
  const spentThisMonthUsd = await repositories.benchmarkRuns.officialSpendSince(startOfMonth(now));

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
    const existing = await repositories.benchmarkRuns.listOfficialEntrantKeys(
      benchmark.summary.id,
      benchmark.summary.version,
      { retryFailed: request.retryFailed ?? explicit },
    );

    for (const entrant of officialEntrantsFor(models, benchmark, modelIds, existing)) {
      wanted.push({ benchmark, entrant });
    }
  }

  const queued: BenchmarkRun[] = [];

  for (const { benchmark, entrant } of wanted.slice(0, limit)) {
    const record = await repositories.benchmarkRuns.create({
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

    await enqueueBenchmarkRunTask(env, repositories, record.id);
    queued.push(toBenchmarkRun(record));
  }

  return {
    queued,
    skippedForBudget: false,
    spentThisMonthUsd,
    remaining: wanted.length - queued.length,
  };
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
  config: ModelConfigItem | null,
  catalogued: ModelConfigItem | undefined,
  record: BenchmarkRunRecord | undefined,
): BenchmarkOfficialEntrant {
  const known = config ?? catalogued;
  const run = record ? toBenchmarkRun(record) : null;
  const base = {
    modelId,
    name: known ? getModelDisplayName(known) : (run?.entrant.name ?? modelId),
    provider: known?.provider ?? (run?.entrant.kind === "model" ? run.entrant.provider : "unknown"),
    credential: config ? credentialSourceFor(config) : null,
    run,
  };

  if (run && run.status !== "cancelled") {
    return { ...base, status: run.status, reason: run.failureReason };
  }

  if (!config) {
    return {
      ...base,
      status: "unavailable",
      reason: catalogued
        ? `No ${base.provider} key: add your own or set the platform key`
        : "This model is no longer in the catalogue",
    };
  }

  const ineligibility = modelIneligibility(benchmark, config);

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
  repositories: RepositoryManager,
  user: IUser,
): Promise<BenchmarkOfficialOverview> {
  const models = await listOfficialModels(env, user);
  const catalogue = getModels();
  const latest = latestOfficialRuns(await repositories.benchmarkRuns.listOfficial());
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
      spentThisMonthUsd: await repositories.benchmarkRuns.officialSpendSince(startOfMonth(now)),
    },
    boards,
  };
}
