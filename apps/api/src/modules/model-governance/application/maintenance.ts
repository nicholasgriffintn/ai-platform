import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  deploymentChatModelId,
  MODEL_PLATFORM_RECONCILE_TASK_TYPE,
  PLATFORM_DEPLOYMENT_CHAT_PROVIDER,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import type { Repositories } from "~/infrastructure/database/repositories";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { enqueueEvalRun } from "~/modules/model-evaluation/application/suites";
import { ModelEvalRepository } from "~/modules/model-evaluation/infrastructure/ModelEvalRepository";
import { ModelSpendRepository } from "~/modules/model-governance/infrastructure/ModelSpendRepository";
import { expireDecisions } from "~/modules/model-registry/application/decisions";
import { ModelRouteRepository } from "~/modules/model-registry/infrastructure/ModelRouteRepository";
import {
  applyDeploymentState,
  enqueueDeploymentSync,
} from "~/modules/model-serving/application/deployments";
import { ModelDeploymentRepository } from "~/modules/model-serving/infrastructure/ModelDeploymentRepository";
import type { ModelDeploymentRecord } from "~/modules/model-serving/infrastructure/ModelDeploymentRepository";
import { enqueueTrainingSync } from "~/modules/model-training/application/runs";
import { ModelTrainingRepository } from "~/modules/model-training/infrastructure/ModelTrainingRepository";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { UsageEventRepository } from "~/modules/usage/infrastructure/UsageEventRepository";
import type { IEnv } from "~/types";

import type { ModelBudgetRecord } from "../infrastructure/ModelSpendRepository";
import { getWorkspaceSpendLines } from "./spend";

const logger = getLogger({ prefix: "modules/model-governance/maintenance" });

const REPLAY_INTERVAL_MS = 20 * 60 * 60 * 1000;
const STALE_CHECK_MS = 30 * 60 * 1000;
const PAUSABLE = new Set<ModelDeploymentRecord["status"]>([
  "running",
  "scaled_to_zero",
  "updating",
]);

async function scheduleReplays(env: IEnv, repositories: Repositories, now: Date): Promise<number> {
  let scheduled = 0;

  for (const candidate of await repositories.get(ModelEvalRepository).listReplayCandidates()) {
    const lastReplay = await repositories
      .get(ModelEvalRepository)
      .latestRunAt(candidate.suiteId, candidate.routeId, "replay");

    if (lastReplay && now.getTime() - new Date(lastReplay).getTime() < REPLAY_INTERVAL_MS) {
      continue;
    }

    const [suite, route] = await Promise.all([
      repositories.get(ModelEvalRepository).getSuiteById(candidate.suiteId),
      repositories.get(ModelRouteRepository).getRouteById(candidate.routeId),
    ]);

    if (!suite || !route || route.status !== "active") {
      continue;
    }

    await enqueueEvalRun(env, repositories, { suite, route, trigger: "replay", createdBy: null });
    scheduled += 1;
  }

  return scheduled;
}

export async function scheduleModelPlatformReconciles(
  env: IEnv,
  repositories: Repositories,
): Promise<number> {
  const [deployments, runs] = await Promise.all([
    repositories.get(ModelDeploymentRepository).listLive(),
    repositories.get(ModelTrainingRepository).listActive(),
  ]);
  const workspaceIds = [
    ...new Set([
      ...deployments.map((item) => item.workspace_id),
      ...runs.map((item) => item.workspace_id),
    ]),
  ];
  const tasks = new TaskService(env, repositories.get(TaskRepository));
  const hour = new Date().toISOString().slice(0, 13);

  for (const workspaceId of workspaceIds) {
    await tasks.enqueueTask({
      id: `${MODEL_PLATFORM_RECONCILE_TASK_TYPE}:${workspaceId}:${hour}:${Date.now()}`,
      task_type: MODEL_PLATFORM_RECONCILE_TASK_TYPE,
      task_data: { workspaceId },
      priority: 4,
    });
  }

  return workspaceIds.length;
}

export async function runModelGovernanceMaintenance(env: IEnv, repositories: Repositories) {
  const now = new Date();
  const expired = await expireDecisions(repositories);
  const replays = await scheduleReplays(env, repositories, now);

  return { expired, replays };
}

function isStale(lastCheckedAt: string | null, now: Date): boolean {
  return !lastCheckedAt || now.getTime() - new Date(lastCheckedAt).getTime() > STALE_CHECK_MS;
}

function governingBudget(
  budgets: ModelBudgetRecord[],
  projectId: string | null,
): ModelBudgetRecord | null {
  return (
    (projectId ? budgets.find((budget) => budget.project_id === projectId) : undefined) ??
    budgets.find((budget) => budget.project_id === null) ??
    null
  );
}

async function isIdle(
  repositories: Repositories,
  deployment: ModelDeploymentRecord,
  minutes: number,
  now: Date,
): Promise<boolean> {
  if (deployment.spec.scaling.minReplicas === 0 || deployment.status !== "running") {
    return false;
  }

  const [lastUse, lastResume] = await Promise.all([
    repositories.get(UsageEventRepository).lastModelUseAt({
      workspaceId: deployment.workspace_id,
      vendor: PLATFORM_DEPLOYMENT_CHAT_PROVIDER,
      resource: deploymentChatModelId(deployment.id),
    }),
    repositories.get(AuditRepository).lastActionAt({
      workspaceId: deployment.workspace_id,
      targetType: "model_deployment",
      targetId: deployment.id,
      action: "model_deployment.resumed",
    }),
  ]);
  const since = Math.max(
    new Date(deployment.created_at).getTime(),
    lastUse ? new Date(lastUse).getTime() : 0,
    lastResume ? new Date(lastResume).getTime() : 0,
  );

  return now.getTime() - since > minutes * 60_000;
}

async function pauseFor(
  env: IEnv,
  repositories: Repositories,
  deployment: ModelDeploymentRecord,
  reason: string,
): Promise<boolean> {
  try {
    await applyDeploymentState(env, repositories, deployment, "pause", { userId: null, reason });

    return true;
  } catch (error) {
    await repositories.get(ModelDeploymentRepository).update(deployment.id, {
      failure_reason: `Automatic pause failed: ${getErrorMessage(error, "Pause failed")}. Provider costs may continue until the deployment is stopped.`,
    });
    logger.warn("Automatic pause failed", {
      deploymentId: deployment.id,
      error: getErrorMessage(error, "Pause failed"),
    });

    return false;
  }
}

export async function reconcileModelPlatform(
  env: IEnv,
  repositories: Repositories,
  workspaceId: string,
) {
  const now = new Date();
  const [deployments, runs, budgets, lines] = await Promise.all([
    repositories.get(ModelDeploymentRepository).list(workspaceId, { liveOnly: true }),
    repositories.get(ModelTrainingRepository).list(workspaceId, null, true),
    repositories.get(ModelSpendRepository).listBudgets(workspaceId),
    getWorkspaceSpendLines(repositories, workspaceId, now),
  ]);
  const exhausted = new Set(
    lines
      .filter((line) => line.budget.hardStop && line.spentUsd >= line.budget.monthlyLimitUsd)
      .map((line) => line.budget.projectId ?? "workspace"),
  );
  let paused = 0;
  let resynced = 0;

  for (const deployment of deployments) {
    if (deployment.desired_state !== "running") {
      continue;
    }

    const overBudget =
      exhausted.has("workspace") ||
      (deployment.project_id !== null && exhausted.has(deployment.project_id));

    if (overBudget && PAUSABLE.has(deployment.status)) {
      paused += (await pauseFor(
        env,
        repositories,
        deployment,
        "The monthly budget hard stop was reached",
      ))
        ? 1
        : 0;
      continue;
    }

    const idleMinutes = governingBudget(budgets, deployment.project_id)?.idle_pause_minutes ?? null;

    if (idleMinutes !== null && (await isIdle(repositories, deployment, idleMinutes, now))) {
      paused += (await pauseFor(
        env,
        repositories,
        deployment,
        `Idle for more than ${idleMinutes} minutes`,
      ))
        ? 1
        : 0;
      continue;
    }

    if (isStale(deployment.last_checked_at, now)) {
      await enqueueDeploymentSync(env, repositories, deployment.id);
      resynced += 1;
    }
  }

  for (const run of runs) {
    if (isStale(run.last_checked_at, now)) {
      await enqueueTrainingSync(env, repositories, run.id);
      resynced += 1;
    }
  }

  return { paused, resynced };
}
