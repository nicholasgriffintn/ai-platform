import {
  nextFlowStageId,
  PROJECT_TASK_DEFAULT_TOKEN_BUDGET,
  PROJECT_TASK_RUN_TASK_TYPE,
  isTerminalGoalStatus,
  type ProjectTask,
  type ProjectTaskBlockedReason,
} from "@ngriffin_uk/polychat-schemas";

import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { buildAgentPersona } from "~/services/agents/completion-tools";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { GoalService } from "~/services/goals/GoalService";
import { notifyMobileProjectTask } from "~/services/mobile-push";
import { TaskService } from "~/services/tasks/TaskService";
import { parseProjectFlow } from "~/services/workspaces/format";
import type { IEnv, Message } from "~/types";
import { AssistantError, ErrorType, getErrorMessage } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import { extractTextFromMessageContent } from "~/utils/messages";

import { getPendingProjectTaskToolApproval } from "./approvals";
import { createProjectTaskCompletion, projectTaskStatusAfterCompletedGoal } from "./completions";
import { buildStageInstructions, resolveTaskRuntime } from "./flow";
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
  reason: ProjectTaskBlockedReason,
  detail: string,
): Promise<void> {
  await context.repositories.projectTasks.updateTask(taskId, {
    status: "blocked",
    blockedReason: reason,
    blockedDetail: detail.slice(0, 500),
  });
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
    resumeInterrupted: params.resumeInterrupted,
  });

  if (!claimed) {
    return { status: "skipped", detail: "Task was not queued" };
  }

  const project = await context.repositories.workspaces.getProject(projectId);

  if (!project) {
    await blockTask(context, taskId, "run_failed", "The project is no longer available");

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
      "run_failed",
      "The person who started this task is no longer a member of the workspace",
    );

    return { status: "blocked", detail: "Runner identity lost membership" };
  }

  if (claimed.tokenBudget !== null && claimed.tokensSpent >= claimed.tokenBudget) {
    await blockTask(
      context,
      taskId,
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
      flow: parseProjectFlow(project.flow),
    });
  } catch (error) {
    const detail = getErrorMessage(error);

    await blockTask(context, taskId, "missing_capability", detail);

    return { status: "blocked", detail };
  }

  const goalService = new GoalService(context.repositories.goals);
  let goalId = claimed.goalId;

  try {
    await ensureProjectTaskConversation({
      context,
      task: claimed,
      conversationId,
      userId: runnerIdentityUserId,
    });
    await context.repositories.projectTasks.updateTask(taskId, { conversationId });
    const goal = await goalService.setGoal({
      owner: { conversationId },
      user,
      objective: buildGoalObjective(claimed),
      source: "user",
    });

    goalId = goal.id;
    await context.repositories.projectTasks.updateTask(taskId, { goalId });
  } catch (error) {
    const detail = getErrorMessage(error);

    await blockTask(context, taskId, "run_failed", detail);

    return { status: "blocked", detail };
  }

  const activity = await context.repositories.activities.createActivity({
    createdByUserId: runnerIdentityUserId,
    projectId: claimed.projectId,
    conversationId,
    capabilityId: "project_task",
    groupId: taskId,
    kind: "project_task_run",
    status: "running",
    summary: claimed.objective.slice(0, 200),
    data: { taskId, stageId: claimed.stageId },
  });
  let responseTokens = 0;
  let responseOutput = "";

  try {
    const conversationManager = ConversationManager.getInstance({
      database: context.database,
      repositories: context.repositories,
      user,
      env,
      store: true,
    });
    const history = await conversationManager.get(conversationId);
    const response = await handleCreateChatCompletions({
      env,
      context,
      user,
      request: {
        completion_id: conversationId,
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
        tool_choice: "auto",
        metadata: { project_id: claimed.projectId },
        ...(runtime.agent ? { persona: buildAgentPersona(runtime.agent) } : {}),
      },
    });

    if (response instanceof Response) {
      throw new AssistantError(
        "A project task run unexpectedly streamed its response",
        ErrorType.INTERNAL_ERROR,
      );
    }

    responseTokens = response.usage?.total_tokens ?? 0;
    responseOutput = extractTextFromMessageContent(response.choices[0]?.message.content).trim();
  } catch (error) {
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

    await blockTask(context, taskId, "run_failed", detail);
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
  const flow = parseProjectFlow(project.flow);
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
          output: responseOutput,
        })
      : null;
  const nextStatus =
    goal?.status === "completed"
      ? projectTaskStatusAfterCompletedGoal(runtime.stage, nextStageId)
      : projection.status;

  await context.repositories.projectTasks.updateTask(taskId, {
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
  });
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
