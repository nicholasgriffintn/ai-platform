import {
  nextFlowStageId,
  chatRunCommandReceiptResponseSchema,
  PROJECT_TASK_DEFAULT_TOKEN_BUDGET,
  PROJECT_TASK_RUN_TASK_TYPE,
  isTerminalGoalStatus,
  type ChatRun,
  type ProjectTask,
  type ProjectTaskBlockedReason,
} from "@ngriffin_uk/polychat-schemas";

import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { finishUsageReservation } from "~/lib/usage/reservations";
import { buildAgentPersona } from "~/services/agents/completion-tools";
import { scheduleComposioConnectorRunCleanup } from "~/services/apps/connectors/composio-run";
import { recordChatRunOperationalMetric } from "~/services/chat-runs/operational-metrics";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { acquireThread } from "~/services/conversations/coordinator/client";
import { GoalService } from "~/services/goals/GoalService";
import { notifyMobileProjectTask } from "~/services/mobile-push";
import {
  isTaskExecutionOwnershipLostError,
  TaskExecutionLeaseBusyError,
  TaskExecutionOwnershipLostError,
} from "~/services/tasks/task-execution-lease";
import type { TaskExecutionLease } from "~/services/tasks/TaskHandler";
import { TaskService } from "~/services/tasks/TaskService";
import { parseProjectFlow } from "~/services/workspaces/format";
import type { IEnv, Message } from "~/types";
import { AssistantError, ErrorType, getErrorMessage } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { extractTextFromMessageContent } from "~/utils/messages";

import { getPendingProjectTaskToolApproval } from "./approvals";
import { reconcileTaskNotifications } from "./attention";
import { createProjectTaskCompletion, projectTaskStatusAfterCompletedGoal } from "./completions";
import { buildStageInstructions, resolveTaskRuntime } from "./flow";
import { recoverPendingProjectTaskInteraction } from "./interaction-recovery";
import { getPendingProjectTaskQuestions } from "./questions";
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
): Promise<void> {
  const taskService = new TaskService(context.env, context.repositories.tasks);

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
    },
  });
}

export async function queueProjectTaskRun(params: {
  context: ServiceContext;
  task: ProjectTask;
  runnerIdentityUserId: number;
  stageId?: string | null;
  approvedTools?: string[];
}): Promise<ProjectTask> {
  const { context, task, runnerIdentityUserId, stageId } = params;

  if (!context.env.TASK_QUEUE) {
    throw new AssistantError(
      "Task execution is unavailable because the task queue is not configured",
      ErrorType.CONFIGURATION_ERROR,
      503,
    );
  }

  const dispatchTaskId = generateId();
  const conversationId =
    task.blockedReason === "run_failed" && task.conversationId
      ? projectTaskConversationId(task.id, dispatchTaskId)
      : null;
  const queued = await context.repositories.projectTasks.queueTaskForRun({
    taskId: task.id,
    projectId: task.projectId,
    runnerIdentityUserId,
    dispatchTaskId,
    runner: task.runner ?? {
      kind: "conversation",
      agentId: null,
      model: null,
      mode: null,
    },
    tokenBudget: task.tokenBudget ?? PROJECT_TASK_DEFAULT_TOKEN_BUDGET,
    stageId,
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
    );
  } catch (error) {
    await context.repositories.projectTasks.failDispatch({
      taskId: task.id,
      projectId: task.projectId,
      dispatchTaskId,
      detail: "The agent run could not be added to the execution queue. Try again.",
    });
    throw error;
  }

  return queued;
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

function buildContextNotes(task: ProjectTask): string | null {
  const context = task.context;

  if (!context) {
    return null;
  }

  const lines: string[] = [];

  if (context.notes) {
    lines.push(context.notes);
  }

  for (const link of context.links) {
    lines.push(link.label ? `- ${link.label}: ${link.url}` : `- ${link.url}`);
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

export async function ensureProjectTaskConversation(params: {
  context: ServiceContext;
  task: ProjectTask;
  conversationId: string;
  userId: number;
}): Promise<void> {
  const existing = await params.context.repositories.conversations.getConversation(
    params.conversationId,
  );

  if (existing) {
    return;
  }

  await params.context.repositories.conversations.createConversation(
    params.conversationId,
    params.userId,
    params.task.objective.slice(0, 200),
    { project_id: params.task.projectId, type: "task" },
  );
}

export function buildTaskPrompt(params: {
  task: ProjectTask;
  stageInstructions: string | null;
  contextNotes: string | null;
}): string {
  const lines: string[] = [];

  if (params.stageInstructions) {
    lines.push(params.stageInstructions);
  }

  lines.push(`Project task ID: ${params.task.id}`);
  lines.push(`Objective: ${params.task.objective}`);

  if (params.task.expectedOutput) {
    lines.push(`Expected output: ${params.task.expectedOutput}`);
  }

  if (params.task.acceptanceCriteria.length > 0) {
    lines.push(
      [
        "This is done when every one of these holds:",
        ...params.task.acceptanceCriteria.map(
          (criterion, index) => `${index + 1}. ${criterion.text}`,
        ),
      ].join("\n"),
    );
  }

  if (params.contextNotes) {
    lines.push(`Context you were given:\n${params.contextNotes}`);
  }

  if (params.task.constraints?.notes) {
    lines.push(`Constraints: ${params.task.constraints.notes}`);
  }

  if (params.task.constraints?.forbiddenTools?.length) {
    lines.push(
      `You must not use these tools: ${params.task.constraints.forbiddenTools.join(", ")}. They have been withheld.`,
    );
  }

  if (params.task.source === "model") {
    lines.push(
      "This objective was drafted by an assistant rather than written by a person. Treat it as a proposal to verify, not as an instruction to follow blindly.",
    );
  }

  lines.push(
    "Produce a concrete deliverable for this stage in an assistant response before calling complete_goal. A Plan stage must leave an actionable plan; Build must leave the implemented result and validation evidence; Review must leave an evidence-backed review decision. Never present a failed tool call as confirmed evidence. Resolve it successfully or submit an entirely blocked evidence ledger so the task stops for attention. Call complete_goal only once the stage deliverable genuinely satisfies its acceptance criteria. The project flow owns stage approval and advancement: never ask the user to approve, confirm, review, or accept your stage output. If concrete missing information or a still-unresolved decision prevents progress, first reuse every answer already present in the conversation, then call ask_user with up to three concise questions and useful choices instead of writing questions as ordinary text. Never ask the same decision again with a different identifier or wording.",
  );

  return lines.join("\n\n");
}

export function buildTaskRunMessages(history: Message[], prompt: string): Message[] {
  return [...history, { role: "user", content: prompt }];
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
  updates: Parameters<ServiceContext["repositories"]["projectTasks"]["updateTask"]>[1];
}): Promise<ProjectTask> {
  await params.executionLease.assertOwned();
  const updated = await params.context.repositories.projectTasks.updateTask(
    params.taskId,
    params.updates,
    {
      dispatchTaskId: params.dispatchTaskId,
      ownerToken: params.executionLease.ownerToken,
    },
  );

  if (!updated) {
    throw new TaskExecutionOwnershipLostError();
  }

  await reconcileTaskNotifications(params.context, updated, { notifyMobile: false });

  return updated;
}

async function releaseDurableRunResources(
  context: ServiceContext,
  run: ChatRun,
  options: { keepInteractionResources?: boolean } = {},
): Promise<void> {
  await finishUsageReservation({
    repositories: context.repositories,
    kind: "chat_run",
    refId: run.id,
    outcome: "released",
  });

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
    throw new TaskExecutionLeaseBusyError(60);
  }

  try {
    await params.executionLease.assertOwned();
    const current =
      (await params.context.repositories.conversationRuns.getById(params.run.id)) ?? params.run;
    let recovered = current;

    if (
      current.status === "accepted" ||
      current.status === "running" ||
      current.status === "cancelling"
    ) {
      const interrupted = await params.context.repositories.conversationRuns.transition({
        runId: current.id,
        attempt: current.attempt,
        status: "interrupted",
        terminalReason:
          "The durable queue owner ended before this run reached a persisted continuation point.",
      });

      if (!interrupted) {
        throw new TaskExecutionOwnershipLostError();
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
        const failed = await params.context.repositories.conversationRuns.transition({
          runId: recovered.id,
          attempt: recovered.attempt,
          status: "failed",
          terminalReason: interaction.reason,
        });

        if (!failed) {
          throw new TaskExecutionOwnershipLostError();
        }

        recovered = failed;
      }
    }

    await releaseDurableRunResources(params.context, recovered, {
      keepInteractionResources:
        recovered.status === "awaiting_input" || recovered.status === "awaiting_approval",
    });

    recordChatRunOperationalMetric(params.context.env, {
      signal: "recovery",
      runId: recovered.id,
      attempt: recovered.attempt,
      taskId: recovered.projectTaskId ?? undefined,
      outcome: recovered.status === "interrupted" ? "interrupted" : "success",
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
  resumeInterrupted?: boolean;
  executionLease: TaskExecutionLease;
}): Promise<{ status: "completed" | "blocked" | "skipped"; detail?: string }> {
  const { env, taskId, projectId, runnerIdentityUserId } = params;
  const baseContext = createServiceContext({ env });
  const user = await baseContext.repositories.users.getUserById(runnerIdentityUserId);

  if (!user) {
    return { status: "skipped", detail: "Runner identity no longer exists" };
  }

  const context = createServiceContext({ env, user });
  const claimed = await context.repositories.projectTasks.claimQueuedTask({
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

  const project = await context.repositories.workspaces.getProject(projectId);

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

  const membership = await context.repositories.workspaces.getMembership(
    project.workspace_id,
    runnerIdentityUserId,
  );

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

  const goalService = new GoalService(context.repositories.goals);
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
      ? await context.repositories.conversationRuns.getById(claimed.runId)
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
    if (isTaskExecutionOwnershipLostError(error) || error instanceof TaskExecutionLeaseBusyError) {
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
    await context.repositories.activities.failActiveActivitiesByGroup(
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

  const activity = await context.repositories.activities.createActivity({
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
      database: context.database,
      repositories: context.repositories,
      user,
      env,
      store: true,
    });
    const history = await conversationManager.get(conversationId);
    const resumableRunId =
      !params.resumeInterrupted &&
      (previousRun?.status === "awaiting_input" || previousRun?.status === "awaiting_approval")
        ? previousRun.id
        : undefined;
    const response = await handleCreateChatCompletions({
      env,
      context,
      user,
      request: {
        completion_id: conversationId,
        command_id: params.dispatchTaskId,
        command_payload: {
          approvedTools: params.approvedTools ?? [],
          dispatchTaskId: params.dispatchTaskId,
          objective: claimed.objective,
          projectId: claimed.projectId,
          stageId: claimed.stageId,
          taskId: claimed.id,
        },
        ...(resumableRunId ? { run_id: resumableRunId } : {}),
        conversation_type: "task",
        messages: buildTaskRunMessages(
          history,
          buildTaskPrompt({
            task: claimed,
            stageInstructions: buildStageInstructions(runtime),
            contextNotes: buildContextNotes(claimed),
          }),
        ),
        ...(runtime.model ? { model: runtime.model } : {}),
        mode: runtime.mode,
        stream: false,
        store: true,
        enabled_tools: runtime.enabledTools,
        approved_tools: params.approvedTools,
        require_approval_for: runtime.requireApprovalFor,
        enforce_mode_tool_policy: runtime.enforceModeToolPolicy,
        durable_execution: {
          kind: "project_task",
          dispatchTaskId: params.dispatchTaskId,
          executionOwnerToken: params.executionLease.ownerToken,
        },
        tool_choice: "auto",
        metadata: { project_id: claimed.projectId },
        ...(runtime.agent ? { persona: buildAgentPersona(runtime.agent) } : {}),
      },
    });

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
          acceptedRun.status !== "awaiting_approval"
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
    if (isTaskExecutionOwnershipLostError(error)) {
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
            reason: `The agent run failed: ${detail}`,
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
    await context.repositories.activities.updateActivity(activity.id, {
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
    const executedTask = await context.repositories.projectTasks.getTaskById(taskId);

    completedRun = executedTask?.runId
      ? await context.repositories.conversationRuns.getById(executedTask.runId)
      : null;
  }

  if (goal?.status === "active") {
    goal = await goalService.transition({
      goalId: goal.id,
      actor: "system",
      status: "stalled",
      reason: "The agent run ended without completing the goal or requesting input.",
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
  }

  const tokensSpent = claimed.tokensSpent + Math.max(goal?.tokens_spent ?? 0, responseTokens);
  const flow = claimed.flowSnapshot ?? parseProjectFlow(project.flow);
  const nextStageId =
    goal?.status === "completed" && runtime.stage?.advance === "on_goal_complete"
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
          outputIds: completedRun
            ? (
                await context.repositories.outputs.listProjectOutputsForRuns(claimed.projectId, [
                  completedRun.id,
                ])
              ).map((output) => output.id)
            : [],
          output: responseOutput,
        })
      : null;
  const nextStatus =
    goal?.status === "completed"
      ? projectTaskStatusAfterCompletedGoal(runtime.stage, nextStageId)
      : projection.status;

  await updateOwnedProjectTask({
    context,
    taskId,
    dispatchTaskId: params.dispatchTaskId,
    executionLease: params.executionLease,
    updates: {
      status: nextStatus,
      blockedReason: projection.blockedReason,
      blockedDetail: goal?.stopped_reason ?? null,
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
  await context.repositories.activities.updateActivity(activity.id, {
    status: nextStatus === "blocked" ? "waiting" : "succeeded",
    summary: goal?.objective.slice(0, 200) ?? claimed.objective.slice(0, 200),
  });

  const notificationKind =
    projection.blockedReason === "awaiting_input"
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
  const task = await context.repositories.projectTasks.getTaskById(params.taskId);

  if (task?.runId) {
    const run = await context.repositories.conversationRuns.getById(task.runId);

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
  await context.repositories.activities.failActiveActivitiesByGroup(
    "project_task",
    params.taskId,
    params.detail,
  );
}
