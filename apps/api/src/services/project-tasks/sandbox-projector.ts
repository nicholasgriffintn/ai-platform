import type {
  Goal,
  GoalEvidenceEntry,
  LeanProofResult,
  ProjectTask,
  ProjectTaskBlockedReason,
  SandboxProjectTaskDispatchContext,
  SandboxRunData,
  SandboxRunDispatchMessage,
} from "@ngriffin_uk/polychat-schemas";

import { LEAN_PROOF_APP_ID, SANDBOX_RUNS_APP_ID } from "~/constants/app";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ActivityRecord } from "~/repositories/ActivityRepository";
import { GoalService } from "~/services/goals/GoalService";
import { assertSandboxGitHubAuthority } from "~/services/sandbox/worker";
import type { IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

import { createSandboxProjectTaskCompletion } from "./completions";
import { leanProofRequestsMatch } from "./lean-proof-request";

const logger = getLogger({ prefix: "services/project-tasks/sandbox-projector" });

type ProjectionStatus = "blocked" | "review" | "cancelled";

function contextsMatch(
  left: SandboxProjectTaskDispatchContext | undefined,
  right: SandboxProjectTaskDispatchContext | undefined,
): left is SandboxProjectTaskDispatchContext {
  return (
    left !== undefined &&
    right !== undefined &&
    left.dispatchTaskId === right.dispatchTaskId &&
    left.taskId === right.taskId &&
    left.projectId === right.projectId &&
    left.workspaceId === right.workspaceId &&
    left.runnerIdentityUserId === right.runnerIdentityUserId
  );
}

function taskMatchesContext(
  task: ProjectTask,
  context: SandboxProjectTaskDispatchContext,
  runId: string,
): boolean {
  return (
    task.projectId === context.projectId &&
    task.workspaceId === context.workspaceId &&
    task.runnerIdentityUserId === context.runnerIdentityUserId &&
    task.dispatchTaskId === context.dispatchTaskId &&
    task.sandboxRunId === runId &&
    task.runner?.kind === "sandbox" &&
    task.runner.profile === "lean-proof"
  );
}

export async function isSandboxProjectTaskDispatchCurrent(params: {
  context: ServiceContext;
  message: SandboxRunDispatchMessage;
  record: ActivityRecord;
  run: SandboxRunData;
}): Promise<boolean> {
  const { context, message, record, run } = params;
  const linkedContext = run.projectTaskContext;

  if (!linkedContext) {
    return true;
  }

  if (
    !contextsMatch(linkedContext, message.payload.projectTaskContext) ||
    message.runId !== run.runId ||
    message.recordId !== record.id ||
    message.userId !== record.created_by_user_id ||
    record.project_id !== linkedContext.projectId ||
    record.capability_id !== SANDBOX_RUNS_APP_ID ||
    record.group_id !== run.runId ||
    message.payload.installationId !== run.installationId ||
    message.payload.repo !== run.repo ||
    message.payload.task !== run.task ||
    message.payload.taskType !== run.taskType ||
    message.payload.model !== run.model ||
    message.payload.promptStrategy !== run.promptStrategy ||
    message.payload.shouldCommit !== run.shouldCommit ||
    message.payload.timeoutSeconds !== run.timeoutSeconds ||
    message.payload.trustLevel !== run.trustLevel ||
    message.payload.tokenBudget !== run.tokenBudget ||
    !leanProofRequestsMatch(message.payload.leanProof, run.leanProof)
  ) {
    return false;
  }

  const task = await context.repositories.projectTasks.getTaskById(linkedContext.taskId);

  return (
    task !== null && task.status === "running" && taskMatchesContext(task, linkedContext, run.runId)
  );
}

export async function assertCurrentSandboxProjectTaskAuthority(params: {
  context: ServiceContext;
  message: SandboxRunDispatchMessage;
  record: ActivityRecord;
  run: SandboxRunData;
  user: IUser;
}): Promise<void> {
  const { context, message, record, run, user } = params;
  const linkedContext = run.projectTaskContext;

  if (!linkedContext) {
    return;
  }

  if (
    user.id !== linkedContext.runnerIdentityUserId ||
    !(await isSandboxProjectTaskDispatchCurrent({ context, message, record, run }))
  ) {
    throw new AssistantError(
      "The sandbox project task dispatch is no longer current",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (user.plan_id !== "pro") {
    throw new AssistantError(
      "Lean Proofs requires an active Pro plan",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const project = await context.repositories.workspaces.getProject(linkedContext.projectId);

  if (!project || project.workspace_id !== linkedContext.workspaceId) {
    throw new AssistantError("The project is no longer available", ErrorType.NOT_FOUND, 404);
  }

  const [membership, capabilities] = await Promise.all([
    context.repositories.workspaces.getMembership(project.workspace_id, user.id),
    context.repositories.workspaces.listProjectCapabilities(project.id),
  ]);
  const leanProofsEnabled = capabilities.some(
    (capability) => capability.kind === "app" && capability.capability_id === LEAN_PROOF_APP_ID,
  );

  if (!membership) {
    throw new AssistantError(
      "The run identity is no longer a project member",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  if (!leanProofsEnabled) {
    throw new AssistantError(
      "Lean Proofs is no longer enabled for this project",
      ErrorType.CONFIGURATION_ERROR,
      409,
    );
  }

  if (
    project.coding_enabled !== 1 ||
    project.coding_installation_id !== run.installationId ||
    project.coding_repository !== run.repo ||
    message.payload.installationId !== project.coding_installation_id ||
    message.payload.repo !== project.coding_repository
  ) {
    throw new AssistantError(
      "The project's coding environment changed before the proof run started",
      ErrorType.CONFIGURATION_ERROR,
      409,
    );
  }

  await assertSandboxGitHubAuthority({
    context,
    userId: user.id,
    repo: project.coding_repository,
    installationId: project.coding_installation_id,
  });
}

function toGoalEvidence(result: LeanProofResult, runId: string): GoalEvidenceEntry[] {
  return result.evidence.map((entry) => ({
    claim: entry.summary,
    route: entry.kind,
    evidence_surface: entry.path ?? entry.declaration ?? `sandbox run ${runId}`,
    status:
      entry.status === "passed"
        ? "confirmed"
        : entry.status === "warning"
          ? "supporting"
          : "blocked",
    ...(entry.status === "passed"
      ? {}
      : { remaining_uncertainty: "The proof check did not pass cleanly." }),
  }));
}

async function reconcileGoal(params: {
  context: ServiceContext;
  goal: Goal;
  result: LeanProofResult | null;
  run: SandboxRunData;
}): Promise<Goal> {
  const { context, run, result } = params;
  let goal = params.goal;

  if (goal.status !== "active") {
    return goal;
  }

  const goals = new GoalService(context.repositories.goals);

  if (
    run.status === "completed" &&
    result &&
    (result.outcome === "kernel_checked" || result.outcome === "compiled")
  ) {
    try {
      return await goals.completeGoal({
        goalId: goal.id,
        evidence: toGoalEvidence(result, run.runId),
        summary: result.summary,
      });
    } catch (error) {
      const current = await goals.getGoalById(goal.id);

      if (current && current.status !== "active") {
        return current;
      }

      throw error;
    }
  }

  const reason =
    run.status === "cancelled"
      ? (run.cancellationReason ?? "The sandbox run was cancelled.")
      : (result?.summary ??
        run.error ??
        "The sandbox run did not produce a reviewable proof result.");

  try {
    goal = await goals.transition({
      goalId: goal.id,
      actor: "system",
      status: "blocked",
      reason,
      evidence: result ? toGoalEvidence(result, run.runId) : undefined,
    });
  } catch (error) {
    const current = await goals.getGoalById(goal.id);

    if (!current || current.status === "active") {
      throw error;
    }

    goal = current;
  }

  return goal;
}

function resolveProjection(params: {
  run: SandboxRunData;
  result: LeanProofResult | null;
  goal: Goal;
}): { status: ProjectionStatus; blockedReason: ProjectTaskBlockedReason | null; detail: string } {
  const { run, result, goal } = params;

  if (run.status === "cancelled" || goal.status === "cleared") {
    return {
      status: "cancelled",
      blockedReason: null,
      detail: run.cancellationReason ?? goal.stopped_reason ?? "The proof run was cancelled.",
    };
  }

  if (result?.outcome === "incomplete") {
    const stoppedAtTokenBudget =
      run.status === "failed" &&
      run.result?.success === false &&
      run.result.error === result.summary &&
      /\btoken budget\b/i.test(result.summary);

    return {
      status: "blocked",
      blockedReason: stoppedAtTokenBudget ? "token_budget" : "verification_failed",
      detail: result.summary,
    };
  }

  if (run.status === "failed" || !result || result.outcome === "failed") {
    return {
      status: "blocked",
      blockedReason: "run_failed",
      detail: result?.summary ?? run.error ?? "The proof run failed.",
    };
  }

  if (goal.status !== "completed") {
    return {
      status: "blocked",
      blockedReason: "run_failed",
      detail: "The proof result could not be reconciled with its goal.",
    };
  }

  return { status: "review", blockedReason: null, detail: result.summary };
}

function existingProjectionIsExact(
  task: ProjectTask,
  runId: string,
  outputId: string,
  resultExists: boolean,
): boolean {
  if (task.sandboxRunId !== runId || task.outputId !== (resultExists ? outputId : null)) {
    return false;
  }

  if (task.status === "blocked" || task.status === "cancelled") {
    return true;
  }

  return task.completions.some(
    (completion) =>
      completion.runtime === "sandbox" &&
      completion.sandboxRunId === runId &&
      completion.outputId === outputId,
  );
}

export async function projectSandboxRunToProjectTask(params: {
  context: ServiceContext;
  message: SandboxRunDispatchMessage;
  record: ActivityRecord;
  run: SandboxRunData;
}): Promise<"projected" | "duplicate" | "not_linked" | "stale"> {
  const { context, message, record, run } = params;
  const linkedContext = run.projectTaskContext;

  if (!linkedContext) {
    return "not_linked";
  }

  if (
    !contextsMatch(linkedContext, message.payload.projectTaskContext) ||
    message.runId !== run.runId ||
    message.recordId !== record.id ||
    message.userId !== record.created_by_user_id ||
    record.project_id !== linkedContext.projectId ||
    record.capability_id !== SANDBOX_RUNS_APP_ID ||
    record.group_id !== run.runId
  ) {
    logger.warn("Ignoring sandbox task projection with mismatched immutable linkage", {
      run_id: message.runId,
      record_id: message.recordId,
      task_id: linkedContext.taskId,
    });

    return "stale";
  }

  const task = await context.repositories.projectTasks.getTaskById(linkedContext.taskId);

  if (!task || !taskMatchesContext(task, linkedContext, run.runId)) {
    return "stale";
  }

  const outputId = `lean-proof-${run.runId}`;
  const result = run.result?.leanProof ?? null;

  if (existingProjectionIsExact(task, run.runId, outputId, Boolean(result))) {
    return "duplicate";
  }

  if (task.status !== "running" || task.outputId !== null || !task.goalId) {
    return "stale";
  }

  const projectionClaimId = generateId();
  const projectionClaim = {
    taskId: task.id,
    projectId: linkedContext.projectId,
    workspaceId: linkedContext.workspaceId,
    runnerIdentityUserId: linkedContext.runnerIdentityUserId,
    dispatchTaskId: linkedContext.dispatchTaskId,
    sandboxRunId: run.runId,
    goalId: task.goalId,
    projectionClaimId,
  };
  const claimed =
    await context.repositories.projectTasks.claimSandboxRunProjection(projectionClaim);

  if (!claimed) {
    const current = await context.repositories.projectTasks.getTaskById(task.id);

    if (current && existingProjectionIsExact(current, run.runId, outputId, Boolean(result))) {
      return "duplicate";
    }

    return "stale";
  }

  let finalised = false;

  try {
    const goal = await context.repositories.goals.getGoalById(task.goalId);

    if (
      !goal ||
      goal.sandbox_run_id !== run.runId ||
      goal.user_id !== linkedContext.runnerIdentityUserId
    ) {
      return "stale";
    }

    const reconciledGoal = await reconcileGoal({ context, goal, result, run });
    const projection = resolveProjection({ run, result, goal: reconciledGoal });
    const createdAt = run.completedAt ?? new Date().toISOString();
    const output = result
      ? await context.repositories.outputs.createOutputOnce({
          id: outputId,
          createdByUserId: linkedContext.runnerIdentityUserId,
          projectId: linkedContext.projectId,
          capabilityId: LEAN_PROOF_APP_ID,
          groupId: run.runId,
          kind: "lean.proof",
          title: `Lean proof: ${result.targetPaths[0]}`,
          status:
            result.outcome === "kernel_checked" || result.outcome === "compiled"
              ? "ready"
              : "failed",
          sensitivity: "internal",
          content: result,
        })
      : null;
    const completion =
      result && projection.status === "review" && output
        ? createSandboxProjectTaskCompletion({
            id: `lean-proof-completion-${run.runId}`,
            sandboxRunId: run.runId,
            outputId: output.id,
            goal: reconciledGoal,
            output: result.summary,
            evidence: toGoalEvidence(result, run.runId),
            createdAt,
          })
        : null;
    const projected = await context.repositories.projectTasks.projectSandboxRunResult({
      taskId: task.id,
      projectId: linkedContext.projectId,
      workspaceId: linkedContext.workspaceId,
      runnerIdentityUserId: linkedContext.runnerIdentityUserId,
      dispatchTaskId: linkedContext.dispatchTaskId,
      sandboxRunId: run.runId,
      goalId: reconciledGoal.id,
      outputId: output?.id ?? null,
      status: projection.status,
      blockedReason: projection.blockedReason,
      blockedDetail: projection.detail,
      completions: completion ? [...task.completions, completion] : task.completions,
      tokensSpent:
        task.tokensSpent + (result?.usage.totalTokens ?? run.result?.usage?.totalTokens ?? 0),
      completedAt: projection.status === "cancelled" ? createdAt : null,
      projectionClaimId,
    });

    if (!projected) {
      const current = await context.repositories.projectTasks.getTaskById(task.id);

      if (current && existingProjectionIsExact(current, run.runId, outputId, Boolean(result))) {
        return "duplicate";
      }

      return "stale";
    }

    finalised = true;

    return "projected";
  } finally {
    if (!finalised) {
      try {
        await context.repositories.projectTasks.releaseSandboxRunProjection(projectionClaim);
      } catch (error) {
        logger.warn("Failed to release an incomplete sandbox projection lease", {
          task_id: task.id,
          run_id: run.runId,
          error,
        });
      }
    }
  }
}
