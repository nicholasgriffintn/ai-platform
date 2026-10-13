import {
  canBatchModelRoute,
  MODEL_REGISTRY_EVAL_TASK_TYPE,
  type EvalCaseResult,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { getBatchProvider } from "~/infrastructure/providers/capabilities/batch";
import type { ModelRouteRecord } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import type {
  ModelEvalRunRecord,
  ModelEvalSuiteRecord,
} from "../infrastructure/ModelEvalRepository";
import {
  casesForRun,
  completeEvalRun,
  failedCaseResult,
  gradeCaseOutput,
  writeEvalResults,
} from "./run-results";

export const BATCH_POLL_DELAY_MS = 10 * 60 * 1000;
export const BATCH_MAX_POLL_ATTEMPTS = 150;
const BATCH_MAX_TOKENS = 2048;

const batchHandleSchema = z.object({
  provider: z.string(),
  batchId: z.string().min(1),
});

type BatchHandle = z.infer<typeof batchHandleSchema>;

function batchHandleKey(runId: string): string {
  return `model-registry/eval-runs/${runId}.batch.json`;
}

function batchItemId(index: number): string {
  return `case_${index}`;
}

export function canBatchEvalRoute(route: Pick<ModelRouteRecord, "deployment_id" | "provider">) {
  return canBatchModelRoute({
    provider: route.provider,
    deploymentId: route.deployment_id ?? null,
  });
}

async function readBatchHandle(bucket: R2Bucket, runId: string): Promise<BatchHandle | null> {
  const object = await bucket.get(batchHandleKey(runId));

  return object ? batchHandleSchema.parse(await object.json()) : null;
}

async function schedulePoll(
  env: IEnv,
  repositories: RepositoryManager,
  runId: string,
  pollAttempt: number,
): Promise<void> {
  await new TaskService(env, repositories.tasks).enqueueTask({
    id: `${MODEL_REGISTRY_EVAL_TASK_TYPE}:${runId}:batch:${pollAttempt}`,
    task_type: MODEL_REGISTRY_EVAL_TASK_TYPE,
    task_data: { runId, offset: 0, readinessAttempt: 0, batch: true, pollAttempt },
    schedule_type: "scheduled",
    scheduled_at: new Date(Date.now() + BATCH_POLL_DELAY_MS).toISOString(),
    priority: 6,
  });
}

export async function executeBatchedEvalRun(
  env: IEnv,
  repositories: RepositoryManager,
  input: {
    run: ModelEvalRunRecord;
    suite: ModelEvalSuiteRecord;
    route: ModelRouteRecord;
    bucket: R2Bucket;
    pollAttempt: number;
  },
) {
  const { run, suite, route, bucket, pollAttempt } = input;

  if (!canBatchEvalRoute(route)) {
    throw new Error("Batch runs need an OpenAI or Anthropic route without a deployment");
  }

  const provider = getBatchProvider(route.provider, { env });
  const cases = casesForRun(suite, run);
  const handle = await readBatchHandle(bucket, run.id);

  if (!handle) {
    const { batchId } = await provider.submit(
      cases.map((item, index) => ({
        id: batchItemId(index),
        model: route.provider_model_id,
        prompt: item.input,
        system: suite.system_prompt ?? undefined,
        maxTokens: BATCH_MAX_TOKENS,
      })),
    );

    await bucket.put(
      batchHandleKey(run.id),
      JSON.stringify({
        provider: route.provider,
        batchId,
      } satisfies BatchHandle),
      { httpMetadata: { contentType: "application/json" } },
    );
    await repositories.modelEvals.updateRun(run.id, { status: "running" });
    await schedulePoll(env, repositories, run.id, 1);

    return { status: "success" as const, message: `Submitted batch ${batchId}` };
  }

  const poll = await provider.poll(handle.batchId);

  if (poll.status === "in_progress") {
    if (pollAttempt >= BATCH_MAX_POLL_ATTEMPTS) {
      await repositories.modelEvals.updateRun(run.id, {
        status: "failed",
        failure_reason: "The batch did not finish within its 24-hour window",
      });

      return { status: "error" as const, message: "Batch timed out" };
    }

    await schedulePoll(env, repositories, run.id, pollAttempt + 1);

    return { status: "success" as const, message: "Batch still running" };
  }

  if (poll.status === "failed") {
    await repositories.modelEvals.updateRun(run.id, {
      status: "failed",
      failure_reason: poll.reason,
    });

    return { status: "error" as const, message: poll.reason };
  }

  const judge = await getAuxiliaryModel(env);
  const graders = await repositories.modelGraders.listByIds(suite.grader_ids);
  const byId = new Map(poll.results.map((result) => [result.id, result]));
  const results: EvalCaseResult[] = [];

  for (const [index, item] of cases.entries()) {
    const result = byId.get(batchItemId(index));

    results.push(
      typeof result?.text === "string"
        ? await gradeCaseOutput(env, repositories, suite, graders, item, result.text, 0, judge)
        : failedCaseResult(graders, item, result?.error ?? "The batch returned no result", 0),
    );
  }

  await writeEvalResults(bucket, run.id, results);
  await repositories.modelEvals.updateRun(run.id, { cases_completed: results.length });
  await completeEvalRun(repositories, {
    suite,
    graders,
    run,
    route,
    results,
    measureLatency: false,
  });

  return { status: "success" as const, message: `Completed ${results.length} batched cases` };
}
