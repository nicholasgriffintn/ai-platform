import {
  sandboxPromptStrategySchema,
  type ProjectTask,
  type SandboxProjectTaskDispatchContext,
} from "@ngriffin_uk/polychat-schemas";

import { LEAN_PROOF_APP_ID, SANDBOX_RUNS_APP_ID } from "~/constants/app";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ProjectRow } from "~/repositories/WorkspaceRepository";
import {
  enqueuePreparedSandboxRun,
  failPreparedSandboxRun,
  prepareSandboxRun,
  type PreparedSandboxRun,
} from "~/services/apps/sandbox/create-run";
import { buildSandboxRunDispatchMessage } from "~/services/apps/sandbox/dispatch";
import { parseSandboxRunData } from "~/services/apps/sandbox/run-data";
import { GoalService } from "~/services/goals/GoalService";
import { assertSandboxGitHubAuthority } from "~/services/sandbox/worker";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";

import { projectSandboxRunToProjectTask } from "./sandbox-projector";

const LEANSTRAL_MODEL = "labs-leanstral-1-5";
const LEAN_PROOF_MAX_TIMEOUT_SECONDS = 55 * 60;

export function resolveLeanProofTimeoutSeconds(
  configuredTimeoutSeconds: number | null | undefined,
): number | undefined {
  if (configuredTimeoutSeconds === null || configuredTimeoutSeconds === undefined) {
    return undefined;
  }

  return Math.min(configuredTimeoutSeconds, LEAN_PROOF_MAX_TIMEOUT_SECONDS);
}

export function isLeanProofTask(task: Pick<ProjectTask, "runner">): boolean {
  return task.runner?.kind === "sandbox" && task.runner.profile === "lean-proof";
}

export async function assertLeanProofTaskConfiguration(params: {
  context: ServiceContext;
  project: ProjectRow;
  task: Pick<ProjectTask, "runner">;
}): Promise<void> {
  const { context, project, task } = params;

  if (!isLeanProofTask(task)) {
    return;
  }

  const capabilities = await context.repositories.workspaces.listProjectCapabilities(project.id);
  const enabled = capabilities.some(
    (capability) => capability.kind === "app" && capability.capability_id === LEAN_PROOF_APP_ID,
  );

  if (!enabled) {
    throw new AssistantError(
      "Enable Lean Proofs in this project before running a proof task",
      ErrorType.CONFIGURATION_ERROR,
      409,
    );
  }

  if (
    project.coding_enabled !== 1 ||
    !project.coding_installation_id ||
    !project.coding_repository
  ) {
    throw new AssistantError(
      "Configure a GitHub coding environment for this project before running a proof task",
      ErrorType.CONFIGURATION_ERROR,
      409,
    );
  }
}

function buildProjectTaskContext(task: ProjectTask): SandboxProjectTaskDispatchContext {
  if (!task.runnerIdentityUserId || !task.dispatchTaskId) {
    throw new AssistantError(
      "The proof task is missing its exact dispatch identity",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return {
    dispatchTaskId: task.dispatchTaskId,
    taskId: task.id,
    projectId: task.projectId,
    workspaceId: task.workspaceId,
    runnerIdentityUserId: task.runnerIdentityUserId,
  };
}

async function closePreparedRun(params: {
  context: ServiceContext;
  prepared: PreparedSandboxRun;
  goalId: string | null;
  error: unknown;
  runAlreadyFailed?: boolean;
}): Promise<void> {
  if (!params.runAlreadyFailed) {
    await failPreparedSandboxRun({
      env: params.context.env,
      context: params.context,
      prepared: params.prepared,
      error: params.error,
    });
  }

  if (!params.goalId) {
    return;
  }

  const goalService = new GoalService(params.context.repositories.goals);
  const goal = await goalService.getGoalById(params.goalId);

  if (goal?.status === "active" || goal?.status === "paused") {
    await goalService.transition({
      goalId: goal.id,
      actor: "system",
      status: "blocked",
      reason: "The proof run could not be attached to its project task.",
    });
  }
}

async function recoverAttachedLeanProofRun(params: {
  context: ServiceContext;
  task: ProjectTask;
}): Promise<{ runId: string; goalId: string }> {
  const { context, task } = params;

  if (!task.sandboxRunId || !task.goalId || !task.runnerIdentityUserId) {
    throw new AssistantError(
      "The proof task has an incomplete sandbox run attachment",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const projectTaskContext = buildProjectTaskContext(task);
  const record = await context.repositories.activities.getActivityByGroup(
    SANDBOX_RUNS_APP_ID,
    task.sandboxRunId,
  );
  const run = record ? parseSandboxRunData(safeParseJson(record.data)) : null;

  if (
    !record ||
    !run ||
    record.project_id !== task.projectId ||
    record.created_by_user_id !== task.runnerIdentityUserId ||
    run.runId !== task.sandboxRunId ||
    run.projectTaskContext?.dispatchTaskId !== projectTaskContext.dispatchTaskId ||
    run.projectTaskContext.taskId !== projectTaskContext.taskId ||
    run.projectTaskContext.projectId !== projectTaskContext.projectId ||
    run.projectTaskContext.workspaceId !== projectTaskContext.workspaceId ||
    run.projectTaskContext.runnerIdentityUserId !== projectTaskContext.runnerIdentityUserId
  ) {
    throw new AssistantError(
      "The proof task's attached sandbox run could not be recovered",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const message = buildSandboxRunDispatchMessage({
    recordId: record.id,
    runId: run.runId,
    userId: task.runnerIdentityUserId,
    payload: {
      installationId: run.installationId,
      repo: run.repo,
      task: run.task,
      taskType: run.taskType,
      model: run.model,
      promptStrategy: run.promptStrategy,
      shouldCommit: run.shouldCommit,
      timeoutSeconds: run.timeoutSeconds,
      trustLevel: run.trustLevel ?? "balanced",
      leanProof: run.leanProof,
      tokenBudget: run.tokenBudget,
      projectTaskContext,
    },
  });

  if (record.status === "queued" && run.status === "queued" && !run.queueDispatchedAt) {
    await enqueuePreparedSandboxRun({
      env: context.env,
      context,
      projectId: task.projectId,
      prepared: {
        record,
        run,
        message,
      },
    });
  }

  if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
    await projectSandboxRunToProjectTask({ context, message, record, run });
  }

  return { runId: task.sandboxRunId, goalId: task.goalId };
}

export async function dispatchLeanProofProjectTask(params: {
  context: ServiceContext;
  user: IUser;
  task: ProjectTask;
  project: ProjectRow;
}): Promise<{ runId: string; goalId: string }> {
  const { context, user, task, project } = params;

  if (!isLeanProofTask(task) || task.runner?.kind !== "sandbox") {
    throw new AssistantError("This task is not a Lean proof task", ErrorType.PARAMS_ERROR, 400);
  }

  if (task.sandboxRunId || task.goalId) {
    return recoverAttachedLeanProofRun({ context, task });
  }

  await assertLeanProofTaskConfiguration({ context, project, task });

  const installationId = project.coding_installation_id;
  const repo = project.coding_repository;

  if (!installationId || !repo) {
    throw new AssistantError(
      "Project coding environment is incomplete",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  await assertSandboxGitHubAuthority({
    context,
    userId: user.id,
    repo,
    installationId,
  });

  const tokenBudget = task.tokenBudget === null ? undefined : task.tokenBudget - task.tokensSpent;

  if (tokenBudget !== undefined && tokenBudget <= 0) {
    throw new AssistantError("This task has spent its token budget", ErrorType.RATE_LIMIT_ERROR);
  }

  const projectTaskContext = buildProjectTaskContext(task);
  const runId = `lean-proof-run-${projectTaskContext.dispatchTaskId}`;
  const promptStrategy = sandboxPromptStrategySchema.safeParse(project.coding_prompt_strategy);
  const prepared = await prepareSandboxRun({
    env: context.env,
    context,
    user,
    projectId: project.id,
    runId,
    activityId: `sandbox-activity-${runId}`,
    payload: {
      installationId,
      repo,
      task: task.runner.request.objective,
      taskType: "lean-proof",
      model: LEANSTRAL_MODEL,
      promptStrategy: promptStrategy.success ? promptStrategy.data : "auto",
      shouldCommit: Boolean(project.coding_should_commit),
      timeoutSeconds: resolveLeanProofTimeoutSeconds(project.coding_timeout_seconds),
      trustLevel: "balanced",
      leanProof: task.runner.request,
      tokenBudget,
      projectTaskContext,
    },
  });
  let goalId: string | null = null;
  let enqueueAttempted = false;

  try {
    const goal = await new GoalService(context.repositories.goals).setGoal({
      owner: { sandboxRunId: prepared.run.runId },
      user,
      objective: task.runner.request.objective,
      source: "user",
    });

    goalId = goal.id;
    const attached = await context.repositories.projectTasks.attachSandboxRun({
      ...projectTaskContext,
      sandboxRunId: prepared.run.runId,
      goalId,
    });

    if (!attached) {
      const current = await context.repositories.projectTasks.getTaskById(task.id);

      if (
        !current ||
        current.status !== "running" ||
        current.dispatchTaskId !== projectTaskContext.dispatchTaskId ||
        current.sandboxRunId !== prepared.run.runId ||
        current.goalId !== goalId
      ) {
        throw new AssistantError(
          "The proof task changed before its sandbox run could be attached",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }
    }

    enqueueAttempted = true;
    await enqueuePreparedSandboxRun({
      env: context.env,
      context,
      prepared,
      projectId: project.id,
    });

    return { runId: prepared.run.runId, goalId };
  } catch (error) {
    await closePreparedRun({
      context,
      prepared,
      goalId,
      error,
      runAlreadyFailed: enqueueAttempted,
    });
    throw error;
  }
}
