import {
  fitBradleyTerry,
  getBenchmark,
  listBenchmarks,
  type PairwiseVote,
} from "@ngriffin_uk/polychat-library-benchmarks";
import {
  benchmarkIdSchema,
  type BenchmarkArenaPair,
  type BenchmarkId,
  type BenchmarkVoteRequest,
  type BenchmarkVoteResult,
} from "@ngriffin_uk/polychat-schemas";
import { pickRandom, shuffleCopy } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { BENCHMARKS_CONFIG } from "~/config/benchmarks";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { openSealedJson, sealJson } from "~/infrastructure/secret-envelope";
import type { IEnv, IUser } from "~/types";

import { BenchmarkResultStore } from "../infrastructure/BenchmarkResultStore";
import { listOfficialRuns } from "./boards";

const PAIR_ATTEMPTS = 6;

const pairTokenSchema = z.object({
  benchmarkId: benchmarkIdSchema,
  version: z.number().int(),
  itemId: z.string(),
  leftRunId: z.string(),
  rightRunId: z.string(),
  issuedAt: z.number(),
});

export async function getArenaPair(
  env: IEnv,
  repositories: RepositoryManager,
  benchmarkId: BenchmarkId,
): Promise<{ pair: BenchmarkArenaPair | null }> {
  const benchmark = getBenchmark(benchmarkId);

  if (benchmark.summary.scoring !== "votes") {
    throw new AssistantError(
      `${benchmark.summary.name} is scored automatically`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const runs = await listOfficialRuns(repositories, benchmarkId);

  if (runs.length < 2) {
    return { pair: null };
  }

  const store = BenchmarkResultStore.forEnv(env);

  for (let attempt = 0; attempt < PAIR_ATTEMPTS; attempt += 1) {
    const itemId = pickRandom(benchmark.itemIds);
    const [left, right] = shuffleCopy(runs);

    if (!itemId || !left || !right) {
      break;
    }

    const [leftResults, rightResults] = await Promise.all([
      store.readResults(left.id),
      store.readResults(right.id),
    ]);
    const leftArtefact = leftResults.find((result) => result.itemId === itemId)?.artefact;
    const rightArtefact = rightResults.find((result) => result.itemId === itemId)?.artefact;

    if (!leftArtefact || !rightArtefact) {
      continue;
    }

    return {
      pair: {
        token: await sealJson(env, {
          benchmarkId,
          version: benchmark.summary.version,
          itemId,
          leftRunId: left.id,
          rightRunId: right.id,
          issuedAt: Date.now(),
        }),
        benchmarkId,
        prompt: benchmark.publicItem(itemId).prompt,
        left: leftArtefact,
        right: rightArtefact,
      },
    };
  }

  return { pair: null };
}

export async function submitArenaVote(
  env: IEnv,
  repositories: RepositoryManager,
  user: IUser,
  request: BenchmarkVoteRequest,
): Promise<BenchmarkVoteResult> {
  const token = await openSealedJson(env, request.token, pairTokenSchema);

  if (!token || Date.now() - token.issuedAt > BENCHMARKS_CONFIG.arenaTokenTtlMs) {
    throw new AssistantError(
      "That pair has expired. Load a fresh one",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (getBenchmark(token.benchmarkId).summary.version !== token.version) {
    throw new AssistantError(
      "This benchmark has moved on to a new season",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const [left, right] = await Promise.all([
    repositories.benchmarkRuns.get(token.leftRunId),
    repositories.benchmarkRuns.get(token.rightRunId),
  ]);

  if (!left || !right) {
    throw new AssistantError("One of these entries has been withdrawn", ErrorType.NOT_FOUND, 404);
  }

  const created = await repositories.benchmarkVotes.create({
    benchmarkId: token.benchmarkId,
    version: token.version,
    pairKey: `${token.itemId}:${[left.id, right.id].sort().join(":")}`,
    leftRunId: left.id,
    rightRunId: right.id,
    itemId: token.itemId,
    winner: request.winner,
    voterUserId: user.id,
  });

  if (!created) {
    throw new AssistantError("You have already judged this pair", ErrorType.CONFLICT_ERROR, 409);
  }

  return { left: left.entrant.name, right: right.entrant.name, winner: request.winner };
}

export async function refreshBenchmarkRatings(repositories: RepositoryManager): Promise<number> {
  let updated = 0;

  for (const benchmark of listBenchmarks()) {
    if (benchmark.summary.scoring !== "votes") {
      continue;
    }

    const votes = await repositories.benchmarkVotes.listForBoard(
      benchmark.summary.id,
      benchmark.summary.version,
    );

    if (votes.length === 0) {
      continue;
    }

    const runIds = [...new Set(votes.flatMap((vote) => [vote.left_run_id, vote.right_run_id]))];
    const entrantByRun = new Map(
      (await repositories.benchmarkRuns.listByIds(runIds)).map((run) => [run.id, run.entrant_key]),
    );
    const pairwise: PairwiseVote[] = votes.flatMap((vote) => {
      const left = entrantByRun.get(vote.left_run_id);
      const right = entrantByRun.get(vote.right_run_id);

      return left && right && left !== right ? [{ left, right, winner: vote.winner }] : [];
    });
    const ratings = fitBradleyTerry(pairwise);

    for (const run of await listOfficialRuns(repositories, benchmark.summary.id)) {
      const rating = ratings.get(run.entrant_key);

      if (rating && JSON.stringify(rating) !== JSON.stringify(run.rating)) {
        await repositories.benchmarkRuns.update(run.id, { rating });
        updated += 1;
      }
    }
  }

  return updated;
}
