import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  deploymentChatModelId,
  MODEL_PLATFORM_RECONCILE_TASK_TYPE,
  PLATFORM_DEPLOYMENT_CHAT_PROVIDER,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { enqueueEvalRun } from "~/modules/model-evaluation/application/suites";
import { expireDecisions } from "~/modules/model-registry/application/decisions";
import {
  applyDeploymentState,
  enqueueDeploymentSync,
} from "~/modules/model-serving/application/deployments";
import type { ModelDeploymentRecord } from "~/modules/model-serving/infrastructure/ModelDeploymentRepository";
import { enqueueTrainingSync } from "~/modules/model-training/application/runs";
import { TaskService } from "~/modules/tasks/application/TaskService";
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

async function scheduleReplays(
  env: IEnv,
  repositories: RepositoryManager,
  now: Date,
): Promise<number> {
  let scheduled = 0;

  for (const candidate of await repositories.modelEvals.listReplayCandidates()) {
    const lastReplay = await repositories.modelEvals.latestRunAt(
      candidate.suiteId,
      candidate.routeId,
      "replay",
    );

    if (lastReplay && now.getTime() - new Date(lastReplay).getTime() < REPLAY_INTERVAL_MS) {
      continue;
    }

    const [suite, route] = await Promise.all([
      repositories.modelEvals.getSuiteById(candidate.suiteId),
      repositories.modelRoutes.getRouteById(candidate.routeId),
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
  repositories: RepositoryManager,
): Promise<number> {
  const [deployments, runs] = await Promise.all([
    repositories.modelDeployments.listLive(),
    repositories.modelTraining.listActive(),
  ]);
  const workspaceIds = [
    ...new Set([
      ...deployments.map((item) => item.workspace_id),
      ...runs.map((item) => item.workspace_id),
    ]),
  ];
  const tasks = new TaskService(env, repositories.tasks);
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

export async function runModelGovernanceMaintenance(env: IEnv, repositories: RepositoryManager) {
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
  repositories: RepositoryManager,
  deployment: ModelDeploymentRecord,
  minutes: number,
  now: Date,
): Promise<boolean> {
  if (deployment.spec.scaling.minReplicas === 0 || deployment.status !== "running") {
    return false;
  }

  const [lastUse, lastResume] = await Promise.all([
    repositories.usageEvents.lastModelUseAt({
      workspaceId: deployment.workspace_id,
      vendor: PLATFORM_DEPLOYMENT_CHAT_PROVIDER,
      resource: deploymentChatModelId(deployment.id),
    }),
    repositories.audit.lastActionAt({
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
  repositories: RepositoryManager,
  deployment: ModelDeploymentRecord,
  reason: string,
): Promise<boolean> {
  try {
    await applyDeploymentState(env, repositories, deployment, "pause", { userId: null, reason });

    return true;
  } catch (error) {
    await repositories.modelDeployments.update(deployment.id, {
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
  repositories: RepositoryManager,
  workspaceId: string,
) {
  const now = new Date();
  const [deployments, runs, budgets, lines] = await Promise.all([
    repositories.modelDeployments.list(workspaceId, { liveOnly: true }),
    repositories.modelTraining.list(workspaceId, null, true),
    repositories.modelSpend.listBudgets(workspaceId),
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
