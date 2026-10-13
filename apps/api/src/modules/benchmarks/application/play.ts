import { getBenchmark } from "@ngriffin_uk/polychat-library-benchmarks";
import {
  benchmarkIdSchema,
  type BenchmarkId,
  type BenchmarkItemResult,
  type BenchmarkPlayResult,
  type BenchmarkPlayStart,
  type BenchmarkPlaySubmitRequest,
} from "@ngriffin_uk/polychat-schemas";
import { sha256Hex, shuffleCopy } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { BENCHMARKS_CONFIG } from "~/config/benchmarks";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { openSealedJson, sealJson } from "~/infrastructure/secret-envelope";
import type { IEnv, IUser } from "~/types";

import { BenchmarkResultStore } from "../infrastructure/BenchmarkResultStore";
import { buildRunDetail } from "./boards";
import { summariseRunResults } from "./runner";

const RUN_ID_LENGTH = 32;

const playTokenSchema = z.object({
  benchmarkId: benchmarkIdSchema,
  version: z.number().int(),
  itemIds: z.array(z.string()).min(1),
  issuedAt: z.number(),
});

function requirePlayable(benchmarkId: BenchmarkId) {
  const benchmark = getBenchmark(benchmarkId);

  if (!benchmark.summary.playable) {
    throw new AssistantError(
      `${benchmark.summary.name} is judged by votes, not played`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return benchmark;
}

export async function startBenchmarkPlay(
  env: IEnv,
  benchmarkId: BenchmarkId,
): Promise<BenchmarkPlayStart> {
  const benchmark = requirePlayable(benchmarkId);
  const itemIds = shuffleCopy(benchmark.itemIds).slice(0, benchmark.summary.itemsPerPlay);

  return {
    token: await sealJson(env, {
      benchmarkId,
      version: benchmark.summary.version,
      itemIds,
      issuedAt: Date.now(),
    }),
    benchmark: benchmark.summary,
    items: itemIds.map((itemId) => benchmark.publicItem(itemId)),
  };
}

export async function submitBenchmarkPlay(
  env: IEnv,
  repositories: RepositoryManager,
  user: IUser,
  request: BenchmarkPlaySubmitRequest,
): Promise<BenchmarkPlayResult> {
  const token = await openSealedJson(env, request.token, playTokenSchema);

  if (!token || Date.now() - token.issuedAt > BENCHMARKS_CONFIG.playTokenTtlMs) {
    throw new AssistantError("That game has expired. Start a new one", ErrorType.PARAMS_ERROR, 400);
  }

  const benchmark = requirePlayable(token.benchmarkId);

  if (benchmark.summary.version !== token.version) {
    throw new AssistantError(
      "This benchmark has moved on to a new season",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const answers = new Map(request.answers.map((entry) => [entry.itemId, entry.answer]));
  const results: BenchmarkItemResult[] = token.itemIds.map((itemId) => {
    const answer = benchmark.validateAnswer(answers.get(itemId) ?? null);
    const scored = benchmark.score(itemId, answer);

    return {
      itemId,
      score: scored.score,
      answer,
      output: "",
      artefact: null,
      detail: scored.detail,
      error: null,
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
    };
  });
  const record = await repositories.benchmarkRuns.createOnce({
    id: (await sha256Hex(request.token)).slice(0, RUN_ID_LENGTH),
    benchmarkId: benchmark.summary.id,
    version: benchmark.summary.version,
    scope: "human",
    entrant: { kind: "human", name: user.name ?? "Player" },
    ownerUserId: user.id,
    workspaceId: null,
    status: "completed",
    visibility: "public",
    itemsTotal: results.length,
  });

  if (!record) {
    throw new AssistantError("That game has already been scored", ErrorType.CONFLICT_ERROR, 409);
  }

  const summary = summariseRunResults(benchmark, results);
  const completedAt = new Date().toISOString();

  await BenchmarkResultStore.forEnv(env).writeResults(record.id, results);
  await repositories.benchmarkRuns.update(record.id, {
    items_completed: results.length,
    score: summary.score,
    metrics: summary.metrics,
    completed_at: completedAt,
  });

  const detail = await buildRunDetail(env, repositories, {
    ...record,
    items_completed: results.length,
    score: summary.score,
    metrics: summary.metrics,
    completed_at: completedAt,
  });

  return {
    run: detail.run,
    items: detail.items,
    officialRank: detail.officialRank,
    officialCount: detail.officialCount,
  };
}
