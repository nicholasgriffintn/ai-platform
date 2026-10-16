import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  MODEL_REGISTRY_EVAL_TASK_TYPE,
  type EvalCase,
  type EvalCaseResult,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import type { Repositories } from "~/infrastructure/database/repositories";
import { ModelEvalRepository } from "~/modules/model-evaluation/infrastructure/ModelEvalRepository";
import { ModelGraderRepository } from "~/modules/model-evaluation/infrastructure/ModelGraderRepository";
import { ModelRouteRepository } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import type { ModelRouteRecord } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import { completeWorkspaceRoute } from "~/modules/model-serving/application/route-completion";
import { ModelDeploymentRepository } from "~/modules/model-serving/infrastructure/ModelDeploymentRepository";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import { TaskService } from "~/modules/tasks/application/TaskService";
import { TaskRepository } from "~/modules/tasks/infrastructure/TaskRepository";
import type { IEnv } from "~/types";

import type {
  ModelEvalRunRecord,
  ModelEvalSuiteRecord,
} from "../infrastructure/ModelEvalRepository";
import type { ModelGraderRecord } from "../infrastructure/ModelGraderRepository";
import { executeBatchedEvalRun } from "./batch-runner";
import {
  casesForRun,
  completeEvalRun,
  failedCaseResult,
  gradeCaseOutput,
  readEvalResults,
  writeEvalResults,
  type EvalJudge,
} from "./run-results";

export { readEvalResults } from "./run-results";

const logger = getLogger({ prefix: "modules/model-evaluation/runner" });

const CASES_PER_TASK = 20;
const DEPLOYMENT_READINESS_ATTEMPTS = 18;
const DEPLOYMENT_READINESS_DELAY_MS = 10 * 60 * 1000;

async function runCase(
  env: IEnv,
  repositories: Repositories,
  suite: ModelEvalSuiteRecord,
  graders: readonly ModelGraderRecord[],
  route: ModelRouteRecord,
  item: EvalCase,
  judge: EvalJudge,
): Promise<EvalCaseResult> {
  const started = Date.now();

  try {
    const completion = await completeWorkspaceRoute(
      env,
      repositories,
      route,
      item.input,
      suite.system_prompt,
    );

    return await gradeCaseOutput(
      env,
      repositories,
      suite,
      graders,
      item,
      completion,
      Date.now() - started,
      judge,
    );
  } catch (error) {
    return failedCaseResult(
      graders,
      item,
      getErrorMessage(error, "Unknown error"),
      Date.now() - started,
    );
  }
}

const READY_DEPLOYMENT_STATUSES = new Set(["running", "scaled_to_zero"]);

async function waitForDeployment(
  env: IEnv,
  repositories: Repositories,
  run: ModelEvalRunRecord,
  route: ModelRouteRecord,
  readinessAttempt: number,
): Promise<"ready" | "waiting" | "timed_out"> {
  if (!route.deployment_id) {
    return "ready";
  }

  const deployment = await repositories.get(ModelDeploymentRepository).getById(route.deployment_id);

  if (deployment && READY_DEPLOYMENT_STATUSES.has(deployment.status)) {
    return "ready";
  }

  if (readinessAttempt >= DEPLOYMENT_READINESS_ATTEMPTS) {
    return "timed_out";
  }

  await new TaskService(env, repositories.get(TaskRepository)).enqueueTask({
    id: `${MODEL_REGISTRY_EVAL_TASK_TYPE}:${run.id}:wait:${readinessAttempt + 1}`,
    task_type: MODEL_REGISTRY_EVAL_TASK_TYPE,
    task_data: { runId: run.id, offset: 0, readinessAttempt: readinessAttempt + 1 },
    schedule_type: "scheduled",
    scheduled_at: new Date(Date.now() + DEPLOYMENT_READINESS_DELAY_MS).toISOString(),
    priority: 6,
  });

  return "waiting";
}

export async function executeEvalRun(
  env: IEnv,
  repositories: Repositories,
  data: {
    runId: string;
    offset: number;
    readinessAttempt: number;
    batch: boolean;
    pollAttempt: number;
  },
) {
  const run = await repositories.get(ModelEvalRepository).getRun(data.runId);
  const suite = run ? await repositories.get(ModelEvalRepository).getSuiteById(run.suite_id) : null;
  const route = run
    ? await repositories.get(ModelRouteRepository).getRouteById(run.route_id)
    : null;
  const bucket: R2Bucket | undefined = env.PRIVATE_ASSETS_BUCKET;

  if (!run || !suite || !route) {
    return { status: "skipped" as const, message: `Eval run ${data.runId} is gone` };
  }

  if (!bucket) {
    await repositories.get(ModelEvalRepository).updateRun(run.id, {
      status: "failed",
      failure_reason: "No private storage bucket is configured",
    });

    return { status: "error" as const, message: "No private storage bucket is configured" };
  }

  try {
    if (data.batch) {
      return await executeBatchedEvalRun(env, repositories, {
        run,
        suite,
        route,
        bucket,
        pollAttempt: data.pollAttempt,
      });
    }

    const readiness = await waitForDeployment(env, repositories, run, route, data.readinessAttempt);

    if (readiness === "waiting") {
      return { status: "success" as const, message: "Waiting for the deployment to come up" };
    }

    if (readiness === "timed_out") {
      await repositories.get(ModelEvalRepository).updateRun(run.id, {
        status: "failed",
        failure_reason: "The deployment never became ready",
      });

      return { status: "error" as const, message: "The deployment never became ready" };
    }

    await repositories.get(ModelEvalRepository).updateRun(run.id, { status: "running" });

    const cases = casesForRun(suite, run);
    const judge = await getAuxiliaryModel(env);
    const graders = await repositories.get(ModelGraderRepository).listByIds(suite.grader_ids);
    const previous = data.offset > 0 ? await readEvalResults(bucket, run.id) : [];
    const batch = cases.slice(data.offset, data.offset + CASES_PER_TASK);
    const fresh: EvalCaseResult[] = [];

    for (const item of batch) {
      fresh.push(await runCase(env, repositories, suite, graders, route, item, judge));
    }

    const results = [...previous, ...fresh];
    const nextOffset = data.offset + batch.length;

    await writeEvalResults(bucket, run.id, results);
    await repositories
      .get(ModelEvalRepository)
      .updateRun(run.id, { cases_completed: results.length });

    if (nextOffset < cases.length) {
      await new TaskService(env, repositories.get(TaskRepository)).enqueueTask({
        id: `${MODEL_REGISTRY_EVAL_TASK_TYPE}:${run.id}:${nextOffset}`,
        task_type: MODEL_REGISTRY_EVAL_TASK_TYPE,
        task_data: { runId: run.id, offset: nextOffset, readinessAttempt: 0 },
        priority: 6,
      });

      return { status: "success" as const, message: `${nextOffset}/${cases.length} cases` };
    }

    await completeEvalRun(repositories, {
      suite,
      graders,
      run,
      route,
      results,
      measureLatency: true,
    });

    return { status: "success" as const, message: `Completed ${results.length} cases` };
  } catch (error) {
    const reason = getErrorMessage(error, "Unknown error");

    logger.error("Eval run failed", { runId: run.id, error: reason });
    await repositories
      .get(ModelEvalRepository)
      .updateRun(run.id, { status: "failed", failure_reason: reason });

    return { status: "error" as const, message: reason };
  }
}
