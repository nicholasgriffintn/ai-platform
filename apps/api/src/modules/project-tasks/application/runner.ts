import { finishUsageReservation } from "@ngriffin_uk/polychat-ai-billing";
import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { extractTextFromMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { isTerminalGoalStatus } from "@ngriffin_uk/polychat-library-goals";
import {
  isTaskError,
  leaseBusyError,
  leaseExpiry,
  ownershipLostError,
} from "@ngriffin_uk/polychat-library-tasks";
import {
  nextFlowStageId,
  chatRunCommandReceiptResponseSchema,
  PROJECT_TASK_DEFAULT_CONCURRENCY,
  PROJECT_TASK_DEFAULT_TOKEN_BUDGET,
  PROJECT_TASK_RUN_TASK_TYPE,
  isTerminalProjectTaskStatus,
  teammateRunConfigurationSchema,
  type ChatRun,
  type ProjectTask,
  type ProjectTaskBlockedReason,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { resolveTelemetryIdentity } from "~/infrastructure/telemetry";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { scheduleComposioConnectorRunCleanup } from "~/modules/connectors/application/composio-run";
import { ConversationManager } from "~/modules/conversations/application/manager";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { acquireThread } from "~/modules/conversations/infrastructure/coordinator/client";
import { createGoalService } from "~/modules/goals/application/createGoalService";
import { notifyMobileProjectTask } from "~/modules/mobile-push/application";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { TaskService } from "~/modules/queue/application/TaskService";
import type { TaskExecutionLease } from "~/modules/queue/application/types";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { toProviderMessages } from "~/modules/responses/application/engine/messages/provider-mapping";
import { recordChatRunOperationalMetric } from "~/modules/responses/application/runs/operational-metrics";
import { startResponse } from "~/modules/responses/application/start";
import type { ResponseAuthority, ResponseCommand } from "~/modules/responses/domain/command";
import { assertTeammateEmploymentAvailable } from "~/modules/teammates/application/organisation";
import { enqueueTeammateRun } from "~/modules/teammates/application/run-admission";
import { createUsageRuntime } from "~/modules/usage/application/runtime";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import { parseProjectFlow } from "~/modules/workspaces/application/format";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import type { IEnv, Message } from "~/types";

import { getPendingProjectTaskToolApproval } from "./approvals";
import { reconcileTaskNotifications } from "./attention";
import { settleCasesResolvedBy } from "./case-settlement";
import {
  createProjectTaskCompletion,
  projectTaskStatusAfterCompletedGoal,
  stageAdvancesOnCompletion,
} from "./completions";
import { reviewStageOutputs } from "./council-gate";
import { selectReleasableDependents } from "./dependents";
import { findExecutionRouteBlocker } from "./execution-route";
import { buildStageInstructions, resolveTaskRuntime } from "./flow";
import { recoverPendingProjectTaskInteraction } from "./interaction-recovery";
import { findMetKillCondition, recordProjectTaskRetrospective } from "./plan-checks";
import { buildWorkPurpose } from "./purpose";
import { getPendingProjectTaskQuestions } from "./questions";
import { retainTaskReviewCompletion } from "./review-output";
import { assertReviewDispatchAuthority } from "./review-policy";
import { buildProjectTaskContext } from "./source-context";
import { projectTaskStatusForGoal } from "./transitions";

const logger = getLogger({ prefix: "services/project-tasks/runner" });

export function projectTaskConversationId(taskId: string, attemptId?: string): string {
  return attemptId ? `task_${taskId}_${attemptId}` : `task_${taskId}`;
}

export async function enqueueProjectTaskRun(
  context: ServiceContext,
  task: ProjectTask,
  runnerIdentityUserId: number,
  dispatchTaskId: string,
  conversationId: string | null,
  approvedTools: string[] = [],
  interaction?: { toolName: string; response: Record<string, unknown> },
): Promise<void> {
  const taskService = new TaskService(context.env, context.repositories.get(TaskRepository));

  await taskService.enqueueTask({
    id: dispatchTaskId,
    task_type: PROJECT_TASK_RUN_TASK_TYPE,
    user_id: runnerIdentityUserId,
    project_id: task.projectId,
    priority: 4,
    task_data: {
      dispatchTaskId,
      taskId: task.id,
      projectId: task.projectId,
      runnerIdentityUserId,
      conversationId,
      approvedTools,
      ...(interaction ? { interaction } : {}),
    },
  });
}

export async function queueProjectTaskRun(params: {
  context: ServiceContext;
  task: ProjectTask;
  runnerIdentityUserId: number;
  stageId?: string | null;
  approvedTools?: string[];
  interaction?: { toolName: string; response: Record<string, unknown> };
  automaticReviewPolicyRevision?: string;
}): Promise<ProjectTask> {
  const { context, task, runnerIdentityUserId, stageId } = params;

  if (!context.env.TASK_QUEUE) {
    throw new AssistantError(
      "Task execution is unavailable because the task queue is not configured",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  if (task.runner?.teammateId) {
    await assertTeammateEmploymentAvailable(context, task.workspaceId, task.runner.teammateId);
  }

  const routeBlocker = await findExecutionRouteBlocker(context, task, runnerIdentityUserId);

  if (routeBlocker) {
    const waiting = await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
      status: "blocked",
      blockedReason: routeBlocker.reason,
      blockedDetail: routeBlocker.detail,
      runnerIdentityUserId,
      ...(stageId !== undefined ? { stageId } : {}),
    });

    if (!waiting) {
      throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
    }

    await reconcileTaskNotifications(context, waiting);

    return waiting;
  }

  const dispatchTaskId = generateId();
  const conversationId =
    task.blockedReason === "run_failed" && task.conversationId
      ? projectTaskConversationId(task.id, dispatchTaskId)
      : null;
  const queued = await context.repositories.get(ProjectTaskRepository).queueTaskForRun({
    taskId: task.id,
    projectId: task.projectId,
    runnerIdentityUserId,
    dispatchTaskId,
    runner: task.runner ?? {
      kind: "conversation",
      teammateId: null,
      model: null,
      mode: null,
    },
    tokenBudget: task.tokenBudget ?? PROJECT_TASK_DEFAULT_TOKEN_BUDGET,
    stageId,
    expectedStatus: task.status,
    expectedDispatchTaskId: task.dispatchTaskId,
    automaticReviewPolicyRevision: params.automaticReviewPolicyRevision,
  });

  if (!queued) {
    throw new AssistantError(
      "This task changed before it could be queued. Refresh and try again.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  try {
    await enqueueProjectTaskRun(
      context,
      queued,
      runnerIdentityUserId,
      dispatchTaskId,
      conversationId,
      params.approvedTools,
      params.interaction,
    );
  } catch (error) {
    await context.repositories.get(ProjectTaskRepository).failDispatch({
      taskId: task.id,
      projectId: task.projectId,
      dispatchTaskId,
      detail: "The teammate run could not be added to the execution queue. Try again.",
    });
    throw error;
  }

  return queued;
}

async function loadDependentBoard(context: ServiceContext, projectId: string) {
  const [tasks, active, project] = await Promise.all([
    context.repositories
      .get(ProjectTaskRepository)
      .listProjectTasks(projectId, { includeDone: true }),
    context.repositories.get(ProjectTaskRepository).countActiveTasks(projectId),
    context.repositories.get(WorkspaceRepository).getProject(projectId),
  ]);

  return { tasks, active, project };
}

export async function releaseReadyDependentTasks(
  context: ServiceContext,
  projectId: string,
  finishedTaskId: string,
): Promise<void> {
  try {
    await settleCasesResolvedBy(context, finishedTaskId);
  } catch (error) {
    logger.warn("Linked cases were not settled", {
      taskId: finishedTaskId,
      error: getErrorMessage(error),
    });
  }

  let board: Awaited<ReturnType<typeof loadDependentBoard>>;

  try {
    board = await loadDependentBoard(context, projectId);
  } catch (error) {
    logger.error("Dependent project tasks could not be checked", {
      projectId,
      error: getErrorMessage(error),
    });

    return;
  }

  const { tasks, active, project } = board;

  if (!project) {
    return;
  }

  for (const task of selectReleasableDependents(tasks, PROJECT_TASK_DEFAULT_CONCURRENCY - active)) {
    const flow = task.flowSnapshot ?? parseProjectFlow(project.flow);

    try {
      const queued = await queueProjectTaskRun({
        context,
        task,
        runnerIdentityUserId: task.runnerIdentityUserId,
        stageId: task.stageId ?? flow?.stages[0]?.id ?? null,
      });

      await context.repositories.get(AuditRepository).createRecord({
        workspaceId: task.workspaceId,
        actorUserId: task.runnerIdentityUserId,
        action: "project.task.started",
        targetType: "project_task",
        targetId: task.id,
        metadata: { projectId, stageId: queued.stageId, trigger: "dependencies_done" },
      });
      await reconcileTaskNotifications(context, queued);
    } catch (error) {
      logger.warn("Dependent project task was not released", {
        taskId: task.id,
        error: getErrorMessage(error),
      });
    }
  }
}

function buildGoalObjective(task: ProjectTask): string {
  const lines = [task.objective];

  if (task.expectedOutput) {
    lines.push("", `Expected output: ${task.expectedOutput}`);
  }

  if (task.acceptanceCriteria.length > 0) {
    lines.push(
      "",
      "Done when:",
      ...task.acceptanceCriteria.map((criterion, index) => `${index + 1}. ${criterion.text}`),
    );
  }

  return lines.join("\n");
}

export async function ensureProjectTaskConversation(params: {
  context: ServiceContext;
  task: ProjectTask;
  conversationId: string;
  userId: number;
}): Promise<void> {
  const existing = await params.context.repositories
    .get(ConversationRepository)
    .getConversation(params.conversationId);

  if (existing) {
    return;
  }

  await params.context.repositories
    .get(ConversationRepository)
    .createConversation(params.conversationId, params.userId, params.task.objective.slice(0, 200), {
      project_id: params.task.projectId,
      type: "task",
    });
}

export function buildTaskPrompt(params: {
  task: ProjectTask;
  stageInstructions: string | null;
  contextNotes: string | null;
}): string {
  const acceptanceCriteria = params.task.acceptanceCriteria
    .map((criterion, index) => `${index + 1}. ${criterion.text}`)
    .join("\n");
  const forbiddenTools = params.task.constraints?.forbiddenTools ?? [];

  return renderPrompt("apps/project-tasks/task-prompt", {
    stageInstructions: params.stageInstructions || undefined,
    taskId: params.task.id,
    objective: params.task.objective,
    description: params.task.description || undefined,
    expectedOutput: params.task.expectedOutput || undefined,
    acceptanceCriteria: acceptanceCriteria || undefined,
    contextNotes: params.contextNotes || undefined,
    constraintsNotes: params.task.constraints?.notes || undefined,
    forbiddenTools: forbiddenTools.length > 0 ? forbiddenTools.join(", ") : undefined,
    modelDrafted: params.task.source === "model" ? "true" : undefined,
  });
}

export function buildTaskRunMessages(history: Message[], prompt: string): Message[] {
  const providerHistory = toProviderMessages(history).map(
    ({ parts: _parts, ...message }) => message,
  );

  return [...providerHistory, { role: "user", content: prompt }];
}

async function blockTask(
  context: ServiceContext,
  taskId: string,
  dispatchTaskId: string,
  executionLease: TaskExecutionLease,
  reason: ProjectTaskBlockedReason,
  detail: string,
): Promise<void> {
  await updateOwnedProjectTask({
    context,
    taskId,
    dispatchTaskId,
    executionLease,
    updates: {
      status: "blocked",
      blockedReason: reason,
      blockedDetail: detail.slice(0, 500),
    },
  });
}

async function updateOwnedProjectTask(params: {
  context: ServiceContext;
  taskId: string;
  dispatchTaskId: string;
  executionLease: TaskExecutionLease;
  updates: Parameters<ProjectTaskRepository["updateTask"]>[1];
}): Promise<ProjectTask> {
  await params.executionLease.assertOwned();
  const updated = await params.context.repositories
    .get(ProjectTaskRepository)
    .updateTask(params.taskId, params.updates, {
      dispatchTaskId: params.dispatchTaskId,
      ownerToken: params.executionLease.ownerToken,
    });

  if (!updated) {
    throw ownershipLostError(params.dispatchTaskId);
  }

  await reconcileTaskNotifications(params.context, updated, { notifyMobile: false });

  return updated;
}

async function releaseDurableRunResources(
  context: ServiceContext,
  run: ChatRun,
  options: { keepInteractionResources?: boolean } = {},
): Promise<void> {
  await finishUsageReservation(
    createUsageRuntime({
      env: context.env,
      repositories: context.repositories,
      publisher: context,
    }),
    { kind: "chat_run", refId: run.id, outcome: "released" },
  );

  if (!options.keepInteractionResources) {
    await scheduleComposioConnectorRunCleanup(context, run.id);
  }
}

export async function recoverRedeliveredProjectTaskRun(params: {
  context: ServiceContext;
  conversationId: string;
  executionLease: TaskExecutionLease;
  run: ChatRun;
}): Promise<ChatRun> {
  const lock = await acquireThread({
    env: params.context.env,
    conversationId: params.conversationId,
    kind: "durable_recovery",
  });

  if (lock.acquired === false) {
    throw leaseBusyError(params.run.id, leaseExpiry(Date.now(), 60_000));
  }

  try {
    await params.executionLease.assertOwned();
    const current =
      (await params.context.repositories.get(ConversationRunRepository).getById(params.run.id)) ??
      params.run;
    let recovered = current;

    if (
      current.status === "accepted" ||
      current.status === "running" ||
      current.status === "cancelling"
    ) {
      const interrupted = await params.context.repositories
        .get(ConversationRunRepository)
        .transition({
          runId: current.id,
          attempt: current.attempt,
          status: "interrupted",
          terminalReason:
            "The durable queue owner ended before this run reached a persisted continuation point.",
        });

      if (!interrupted) {
        throw ownershipLostError(params.run.id);
      }

      recovered = interrupted;
    }

    if (recovered.status === "awaiting_input" || recovered.status === "awaiting_approval") {
      const interaction = await recoverPendingProjectTaskInteraction({
        context: params.context,
        conversationId: params.conversationId,
        kind: recovered.status === "awaiting_input" ? "input" : "approval",
        writeFence: lock.lease,
      });

      if (interaction.recovered === false) {
        const failed = await params.context.repositories.get(ConversationRunRepository).transition({
          runId: recovered.id,
          attempt: recovered.attempt,
          status: "failed",
          terminalReason: interaction.reason,
        });

        if (!failed) {
          throw ownershipLostError(params.run.id);
        }

        recovered = failed;
      }
    }

    await releaseDurableRunResources(params.context, recovered, {
      keepInteractionResources:
        recovered.status === "awaiting_input" ||
        recovered.status === "awaiting_approval" ||
        recovered.status === "awaiting_takeover",
    });

    recordChatRunOperationalMetric(params.context.env, {
      signal: "recovery",
      runId: recovered.id,
      attempt: recovered.attempt,
      taskId: recovered.projectTaskId ?? undefined,
      outcome: recovered.status === "interrupted" ? "interrupted" : "success",
      identity: resolveTelemetryIdentity(params.context),
    });

    return recovered;
  } finally {
    await lock.lease.release();
  }
}

export async function runProjectTaskDispatch(params: {
  env: IEnv;
  dispatchTaskId: string;
  taskId: string;
  projectId: string;
  runnerIdentityUserId: number;
  conversationId: string | null;
  approvedTools?: string[];
  interaction?: { toolName: string; response: Record<string, unknown> };
  resumeInterrupted?: boolean;
  executionLease: TaskExecutionLease;
}): Promise<{ status: "completed" | "blocked" | "skipped"; detail?: string }> {
  const { env, taskId, projectId, runnerIdentityUserId } = params;
  const baseContext = createServiceContext({ env });
  const user = await baseContext.repositories.get(UserRepository).getUserById(runnerIdentityUserId);

  if (!user) {
    return { status: "skipped", detail: "Runner identity no longer exists" };
  }

  const context = createServiceContext({ env, user });
  const claimed = await context.repositories.get(ProjectTaskRepository).claimQueuedTask({
    taskId,
    projectId,
    runnerIdentityUserId,
    dispatchTaskId: params.dispatchTaskId,
    executionOwnerToken: params.executionLease.ownerToken,
    resumeInterrupted: params.resumeInterrupted,
  });

  if (!claimed) {
    return { status: "skipped", detail: "Task was not queued" };
  }

  const project = await context.repositories.get(WorkspaceRepository).getProject(projectId);

  if (!project) {
    await blockTask(
      context,
      taskId,
      params.dispatchTaskId,
      params.executionLease,
      "run_failed",
      "The project is no longer available",
    );

    return { status: "blocked", detail: "Project missing" };
  }

  const membership = await context.repositories
    .get(WorkspaceRepository)
    .getMembership(project.workspace_id, runnerIdentityUserId);

  if (!membership) {
    await blockTask(
      context,
      taskId,
      params.dispatchTaskId,
      params.executionLease,
      "run_failed",
      "The person who started this task is no longer a member of the workspace",
    );

    return { status: "blocked", detail: "Runner identity lost membership" };
  }

  if (claimed.tokenBudget !== null && claimed.tokensSpent >= claimed.tokenBudget) {
    await blockTask(
      context,
      taskId,
      params.dispatchTaskId,
      params.executionLease,
      "token_budget",
      "This task has spent its token budget. Raise it to continue.",
    );

    return { status: "blocked", detail: "Token budget exhausted" };
  }

  const conversationId =
    params.conversationId ?? claimed.conversationId ?? projectTaskConversationId(taskId);
  let runtime: Awaited<ReturnType<typeof resolveTaskRuntime>>;

  try {
    await assertReviewDispatchAuthority(context, claimed);
    runtime = await resolveTaskRuntime({
      context,
      task: claimed,
      flow: claimed.flowSnapshot ?? parseProjectFlow(project.flow),
    });
  } catch (error) {
    const detail = getErrorMessage(error);

    await blockTask(
      context,
      taskId,
      params.dispatchTaskId,
      params.executionLease,
      "missing_capability",
      detail,
    );

    return { status: "blocked", detail };
  }

  const goalService = createGoalService(context);
  let goalId = claimed.goalId;
  let previousRun: ChatRun | null = null;

  try {
    await params.executionLease.assertOwned();
    await ensureProjectTaskConversation({
      context,
      task: claimed,
      conversationId,
      userId: runnerIdentityUserId,
    });
    await updateOwnedProjectTask({
      context,
      taskId,
      dispatchTaskId: params.dispatchTaskId,
      executionLease: params.executionLease,
      updates: { conversationId },
    });
    previousRun = claimed.runId
      ? await context.repositories.get(ConversationRunRepository).getById(claimed.runId)
      : null;

    if (params.resumeInterrupted && previousRun) {
      previousRun = await recoverRedeliveredProjectTaskRun({
        context,
        conversationId,
        executionLease: params.executionLease,
        run: previousRun,
      });
    }

    if (!params.resumeInterrupted || !previousRun) {
      const goal = await goalService.setGoal({
        owner: { conversationId },
        user,
        objective: buildGoalObjective(claimed),
        source: "user",
      });

      goalId = goal.id;
      await updateOwnedProjectTask({
        context,
        taskId,
        dispatchTaskId: params.dispatchTaskId,
        executionLease: params.executionLease,
        updates: { goalId },
      });
    }
  } catch (error) {
    if (isTaskError(error, "ownership_lost") || isTaskError(error, "lease_busy")) {
      throw error;
    }

    const detail = getErrorMessage(error);

    await blockTask(
      context,
      taskId,
      params.dispatchTaskId,
      params.executionLease,
      "run_failed",
      detail,
    );

    return { status: "blocked", detail };
  }

  if (params.resumeInterrupted) {
    await params.executionLease.assertOwned();
    await context.repositories
      .get(ActivityRepository)
      .failActiveActivitiesByGroup(
        "project_task",
        taskId,
        "The previous durable execution owner ended before recording an outcome.",
      );
  }

  if (
    params.resumeInterrupted &&
    previousRun &&
    (previousRun.status === "interrupted" ||
      previousRun.status === "failed" ||
      previousRun.status === "cancelled")
  ) {
    const detail =
      previousRun.terminalReason ??
      "The durable execution owner ended before the task reached a safe continuation point.";

    await blockTask(
      context,
      taskId,
      params.dispatchTaskId,
      params.executionLease,
      "run_failed",
      detail,
    );

    return { status: "blocked", detail };
  }

  await params.executionLease.assertOwned();

  const activity = await context.repositories.get(ActivityRepository).createActivity({
    createdByUserId: runnerIdentityUserId,
    projectId: claimed.projectId,
    conversationId,
    capabilityId: "project_task",
    groupId: taskId,
    kind: "project_task_run",
    status: "running",
    summary: claimed.objective.slice(0, 200),
    data: { taskId, stageId: claimed.stageId, dispatchTaskId: params.dispatchTaskId },
  });
  let responseTokens = 0;
  let responseOutput = "";
  let completedRun: ChatRun | null = null;

  try {
    await params.executionLease.assertOwned();
    const conversationManager = ConversationManager.getInstance({
      repositories: context.repositories,
      user,
      env,
      store: true,
    });
    const history = await conversationManager.get(conversationId);
    const previousRunAwaits =
      previousRun?.status === "awaiting_input" ||
      previousRun?.status === "awaiting_approval" ||
      previousRun?.status === "awaiting_takeover";
    const resumableRunId =
      !params.resumeInterrupted &&
      params.interaction &&
      previousRunAwaits &&
      previousRun?.conversationId === conversationId
        ? previousRun.id
        : undefined;

    if (previousRun && previousRunAwaits && !resumableRunId && !params.resumeInterrupted) {
      await context.repositories.get(ConversationRunRepository).transition({
        runId: previousRun.id,
        attempt: previousRun.attempt,
        status: "cancelled",
        terminalReason: "Superseded by a fresh run of this task",
      });
    }

    const contextNotes = await Promise.all([
      buildProjectTaskContext(context, claimed),
      buildWorkPurpose(context, claimed),
    ]);
    const request: ResponseCommand = {
      conversationId,
      conversationType: "task",
      commandId: params.dispatchTaskId,
      ...(resumableRunId ? { runId: resumableRunId } : {}),
      messages: buildTaskRunMessages(
        history,
        buildTaskPrompt({
          task: claimed,
          stageInstructions: buildStageInstructions(runtime),
          contextNotes: contextNotes.filter(Boolean).join("\n\n") || null,
        }),
      ),
      stream: false,
      store: true,
      settings: {
        ...(runtime.model ? { model: runtime.model } : {}),
        mode: runtime.mode,
        enabled_tools: [...runtime.enabledTools],
        ...(claimed.executionProfile === "diff_review"
          ? { tool_selection_mode: "explicit" as const }
          : {}),
        approved_tools: params.approvedTools,
        options: params.interaction ? { toolInteraction: params.interaction } : undefined,
        tool_choice: "auto",
        metadata: { project_id: claimed.projectId },
      },
    };
    const previousConfiguration = resumableRunId
      ? teammateRunConfigurationSchema.safeParse(previousRun?.resolvedConfiguration)
      : null;

    if (resumableRunId && !previousConfiguration?.success && runtime.teammate) {
      throw new AssistantError(
        "The teammate task run has no resumable configuration",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    const resumeConfiguration = previousConfiguration?.success
      ? {
          ...previousConfiguration.data,
          usedSteps: previousConfiguration.data.usedSteps + (previousRun?.context?.step ?? 0),
        }
      : undefined;
    const remainingSteps = resumeConfiguration
      ? resumeConfiguration.maxSteps - resumeConfiguration.usedSteps
      : undefined;

    if (remainingSteps !== undefined && remainingSteps <= 0) {
      throw new AssistantError(
        "The teammate task run has exhausted its step budget",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    const authority: ResponseAuthority = {
      durableExecution: {
        kind: "project_task",
        dispatchTaskId: params.dispatchTaskId,
        executionOwnerToken: params.executionLease.ownerToken,
      },
      commandPayload: {
        approvedTools: params.approvedTools ?? [],
        dispatchTaskId: params.dispatchTaskId,
        objective: claimed.objective,
        projectId: claimed.projectId,
        stageId: claimed.stageId,
        taskId: claimed.id,
      },
      requireApprovalFor: [...runtime.requireApprovalFor],
      enforceModeToolPolicy: runtime.enforceModeToolPolicy,
    };
    const response = runtime.teammate
      ? await enqueueTeammateRun({
          env,
          context,
          body: request,
          teammateId: runtime.teammate.id,
          user,
          anonymousUser: undefined,
          conversationType: "task",
          invocation: {
            source: "project_task",
            taskId: claimed.id,
            projectId: claimed.projectId,
          },
          authority,
          executionPolicy: {
            model: runtime.model,
            mode: runtime.mode,
            skillIds: [...runtime.skillIds],
            enabledTools: [...runtime.enabledTools],
          },
          ...(resumeConfiguration ? { resumeConfiguration } : {}),
          ...(remainingSteps !== undefined ? { maxStepsOverride: remainingSteps } : {}),
        })
      : await startResponse({ env, context, user, command: request, authority });

    if (response instanceof Response) {
      const receiptResponse = chatRunCommandReceiptResponseSchema.safeParse(
        await response.clone().json(),
      );

      if (receiptResponse.success) {
        const acceptedRun = receiptResponse.data.run.run;

        completedRun = acceptedRun;

        if (
          acceptedRun.status !== "succeeded" &&
          acceptedRun.status !== "awaiting_input" &&
          acceptedRun.status !== "awaiting_approval" &&
          acceptedRun.status !== "awaiting_takeover"
        ) {
          throw new AssistantError(
            `The accepted run cannot be reconciled from ${acceptedRun.status}`,
            ErrorType.CONFLICT_ERROR,
          );
        }

        responseOutput = extractTextFromMessageContent(history.at(-1)?.content ?? "").trim();
      } else {
        throw new AssistantError(
          "A project task run unexpectedly streamed its response",
          ErrorType.INTERNAL_ERROR,
        );
      }
    } else {
      responseTokens = response.usage?.total_tokens ?? 0;
      responseOutput = extractTextFromMessageContent(response.choices[0]?.message.content).trim();
    }
  } catch (error) {
    if (isTaskError(error, "ownership_lost")) {
      throw error;
    }

    const detail = getErrorMessage(error);

    logger.error("Project task run failed", { taskId, error: detail });
    if (goalId) {
      try {
        const failedGoal = await goalService.getGoalById(goalId);

        if (failedGoal && !isTerminalGoalStatus(failedGoal.status)) {
          await goalService.transition({
            goalId,
            actor: "system",
            status: "blocked",
            reason: `The teammate run failed: ${detail}`,
          });
        }
      } catch (goalError) {
        logger.error("Failed to close the goal after the task run failed", {
          taskId,
          error: getErrorMessage(goalError),
        });
      }
    }

    await blockTask(
      context,
      taskId,
      params.dispatchTaskId,
      params.executionLease,
      "run_failed",
      detail,
    );
    await params.executionLease.assertOwned();
    await context.repositories.get(ActivityRepository).updateActivity(activity.id, {
      status: "failed",
      summary: detail.slice(0, 200),
    });
    await notifyMobileProjectTask({
      context,
      task: { ...claimed, conversationId },
      notificationId: `project-task:${taskId}:failed:${activity.id}`,
      kind: "failed",
    });

    return { status: "blocked", detail };
  }

  let goal = goalId ? await goalService.getGoalById(goalId) : null;

  if (!completedRun) {
    const executedTask = await context.repositories.get(ProjectTaskRepository).getTaskById(taskId);

    completedRun = executedTask?.runId
      ? await context.repositories.get(ConversationRunRepository).getById(executedTask.runId)
      : null;
  }

  if (goal?.status === "active") {
    goal = await goalService.transition({
      goalId: goal.id,
      actor: "system",
      status: "stalled",
      reason: "The teammate run ended without completing the goal or requesting input.",
    });
  }

  const pendingQuestions = await getPendingProjectTaskQuestions(context, { conversationId });
  const pendingApproval = await getPendingProjectTaskToolApproval(context, { conversationId });
  const projection = goal
    ? projectTaskStatusForGoal(goal)
    : { status: "review" as const, blockedReason: null };

  if (projection.status === "blocked" && pendingQuestions) {
    projection.blockedReason = "awaiting_input";
  } else if (projection.status === "blocked" && pendingApproval) {
    projection.blockedReason = "awaiting_approval";
  } else if (projection.status === "blocked" && completedRun?.status === "awaiting_takeover") {
    projection.blockedReason = "awaiting_takeover";
  }

  const tokensSpent = claimed.tokensSpent + Math.max(goal?.tokens_spent ?? 0, responseTokens);
  const flow = claimed.flowSnapshot ?? parseProjectFlow(project.flow);
  const completedOutputIds =
    goal?.status === "completed" && completedRun
      ? (
          await context.repositories
            .get(OutputRepository)
            .listProjectOutputsForRuns(claimed.projectId, [completedRun.id])
        ).map((output) => output.id)
      : [];
  const metKillCondition = goal
    ? await findMetKillCondition(context, claimed, responseOutput, conversationId)
    : null;
  const council =
    !metKillCondition &&
    goal?.status === "completed" &&
    runtime.stage?.advance === "on_council_ship"
      ? await reviewStageOutputs(context, {
          taskId,
          conversationId,
          outputIds: completedOutputIds,
          runId: completedRun?.id,
          runAttempt: completedRun?.attempt,
        })
      : null;
  const nextStageId =
    !metKillCondition &&
    goal?.status === "completed" &&
    stageAdvancesOnCompletion(runtime.stage, council)
      ? nextFlowStageId(flow, claimed.stageId)
      : null;
  const completion =
    goal?.status === "completed"
      ? createProjectTaskCompletion({
          stage: runtime.stage,
          conversationId,
          goal,
          run: completedRun,
          dispatchTaskId: params.dispatchTaskId,
          outputIds: completedOutputIds,
          output: responseOutput,
          council,
        })
      : null;
  const current = await context.repositories.get(ProjectTaskRepository).getTaskById(taskId);
  const finished = current && isTerminalProjectTaskStatus(current.status) ? current : null;
  const nextStatus = finished
    ? finished.status
    : metKillCondition
      ? "blocked"
      : goal?.status === "completed"
        ? projectTaskStatusAfterCompletedGoal(runtime.stage, nextStageId, council)
        : projection.status;

  await updateOwnedProjectTask({
    context,
    taskId,
    dispatchTaskId: params.dispatchTaskId,
    executionLease: params.executionLease,
    updates: finished
      ? {
          tokensSpent,
          ...(completion ? { completions: [...claimed.completions, completion] } : {}),
        }
      : {
          status: nextStatus,
          blockedReason: metKillCondition ? "kill_condition_met" : projection.blockedReason,
          blockedDetail: metKillCondition?.condition ?? goal?.stopped_reason ?? null,
          tokensSpent,
          ...(completion ? { completions: [...claimed.completions, completion] } : {}),
          ...(nextStatus === "done"
            ? { completedAt: new Date().toISOString() }
            : nextStatus === "review"
              ? { completedAt: null }
              : {}),
        },
  });
  await params.executionLease.assertOwned();
  await context.repositories.get(ActivityRepository).updateActivity(activity.id, {
    status: nextStatus === "blocked" ? "waiting" : "succeeded",
    summary: goal?.objective.slice(0, 200) ?? claimed.objective.slice(0, 200),
  });

  if (finished) {
    return { status: "completed" };
  }

  if (completion && claimed.executionProfile === "diff_review") {
    try {
      await params.executionLease.assertOwned();
      const retainedCompletion = await retainTaskReviewCompletion(context, claimed, completion);

      if (retainedCompletion) {
        await updateOwnedProjectTask({
          context,
          taskId,
          dispatchTaskId: params.dispatchTaskId,
          executionLease: params.executionLease,
          updates: {
            completions: [...claimed.completions, retainedCompletion],
          },
        });
      }
    } catch (error) {
      if (isTaskError(error, "ownership_lost")) {
        throw error;
      }

      logger.warn("Review output will be retained when publication is prepared", {
        taskId,
        error: getErrorMessage(error),
      });
    }
  }

  const notificationKind =
    projection.blockedReason === "awaiting_input" ||
    projection.blockedReason === "awaiting_takeover"
      ? "input"
      : projection.blockedReason === "awaiting_approval"
        ? "approval"
        : nextStatus === "review"
          ? "review"
          : nextStatus === "done"
            ? "completed"
            : null;

  if (notificationKind) {
    await notifyMobileProjectTask({
      context,
      task: { ...claimed, conversationId },
      notificationId: `project-task:${taskId}:${notificationKind}:${activity.id}`,
      kind: notificationKind,
      interactionId:
        projection.blockedReason === "awaiting_input"
          ? pendingQuestions?.interactionId
          : projection.blockedReason === "awaiting_approval"
            ? pendingApproval?.interactionId
            : null,
    });
  }

  if (nextStatus === "done") {
    await recordProjectTaskRetrospective(
      context,
      {
        ...claimed,
        completions: completion ? [...claimed.completions, completion] : claimed.completions,
      },
      "done",
    ).catch((error: unknown) =>
      logger.warn("Could not record the task retrospective", {
        taskId,
        error: getErrorMessage(error),
      }),
    );
    await releaseReadyDependentTasks(context, claimed.projectId, claimed.id);
  }

  if (nextStageId) {
    try {
      await queueProjectTaskRun({
        context,
        task: {
          ...claimed,
          status: nextStatus,
          tokensSpent,
          completions: completion ? [...claimed.completions, completion] : claimed.completions,
        },
        runnerIdentityUserId,
        stageId: nextStageId,
      });
    } catch (error) {
      const detail = getErrorMessage(error);

      logger.error("Project task stage dispatch failed", { taskId, nextStageId, error: detail });

      return { status: "blocked", detail };
    }
  }

  return projection.status === "blocked"
    ? { status: "blocked", detail: goal?.stopped_reason ?? undefined }
    : { status: "completed" };
}

export async function settleFailedProjectTaskDispatch(params: {
  env: IEnv;
  dispatchTaskId: string;
  taskId: string;
  executionLease: TaskExecutionLease;
  detail: string;
}): Promise<void> {
  const context = createServiceContext({ env: params.env });
  const task = await context.repositories.get(ProjectTaskRepository).getTaskById(params.taskId);

  if (task?.runId) {
    const run = await context.repositories.get(ConversationRunRepository).getById(task.runId);

    if (run) {
      await releaseDurableRunResources(context, run);
    }
  }

  await updateOwnedProjectTask({
    context,
    taskId: params.taskId,
    dispatchTaskId: params.dispatchTaskId,
    executionLease: params.executionLease,
    updates: {
      status: "blocked",
      blockedReason: "run_failed",
      blockedDetail: params.detail.slice(0, 500),
    },
  });
  await params.executionLease.assertOwned();
  await context.repositories
    .get(ActivityRepository)
    .failActiveActivitiesByGroup("project_task", params.taskId, params.detail);
}

export async function releaseMachineWaitingTasks(
  context: ServiceContext,
  runnerIdentityUserId: number,
): Promise<void> {
  const waiting = await context.repositories
    .get(ProjectTaskRepository)
    .listBlockedForRunner(runnerIdentityUserId, "machine_offline");

  for (const task of waiting) {
    try {
      await queueProjectTaskRun({
        context,
        task,
        runnerIdentityUserId,
        stageId: task.stageId,
      });
    } catch (error) {
      logger.warn("A task waiting for a machine was not released", {
        taskId: task.id,
        error: getErrorMessage(error),
      });
    }
  }
}
