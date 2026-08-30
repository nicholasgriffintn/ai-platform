import {
  PROJECT_TASK_RUN_TASK_TYPE,
  type ProjectTask,
  type ProjectTaskBlockedReason,
} from "@ngriffin_uk/polychat-schemas";

import { createServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { GoalService } from "~/services/goals/GoalService";
import { TaskService } from "~/services/tasks/TaskService";
import { parseProjectFlow } from "~/services/workspaces/format";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType, getErrorMessage } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

import { buildStageInstructions, resolveTaskRuntime } from "./flow";
import { projectTaskStatusForGoal } from "./transitions";

const logger = getLogger({ prefix: "services/project-tasks/runner" });

export function projectTaskConversationId(taskId: string): string {
  return `task_${taskId}`;
}

export async function enqueueProjectTaskRun(
  context: ServiceContext,
  task: ProjectTask,
  runnerIdentityUserId: number,
): Promise<void> {
  const taskService = new TaskService(context.env, context.repositories.tasks);

  await taskService.enqueueTask({
    task_type: PROJECT_TASK_RUN_TASK_TYPE,
    user_id: runnerIdentityUserId,
    project_id: task.projectId,
    priority: 4,
    task_data: {
      taskId: task.id,
      projectId: task.projectId,
      runnerIdentityUserId,
    },
  });
}

function buildGoalObjective(task: ProjectTask): string {
  if (task.acceptanceCriteria.length > 0) {
    return [
      task.objective,
      "",
      "Done when:",
      ...task.acceptanceCriteria.map((criterion, index) => `${index + 1}. ${criterion.text}`),
    ].join("\n");
  }

  return task.acceptance ? `${task.objective}\n\nDone when: ${task.acceptance}` : task.objective;
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

function buildTaskPrompt(params: {
  task: ProjectTask;
  stageInstructions: string | null;
  contextNotes: string | null;
}): string {
  const lines: string[] = [];

  if (params.stageInstructions) {
    lines.push(params.stageInstructions);
  }

  lines.push(`Objective: ${params.task.objective}`);

  if (params.task.deliverable) {
    const description = params.task.deliverable.description
      ? `: ${params.task.deliverable.description}`
      : "";

    lines.push(`Deliverable — produce a ${params.task.deliverable.kind}${description}`);
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
  } else if (params.task.acceptance) {
    lines.push(`This is done when: ${params.task.acceptance}`);
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
    "Work the objective and call complete_goal only once every part of it is done. Nobody is watching this run, so stop and explain rather than guessing at anything that needs a person's decision.",
  );

  return lines.join("\n\n");
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
  taskId: string;
  projectId: string;
  runnerIdentityUserId: number;
}): Promise<{ status: "completed" | "blocked" | "skipped"; detail?: string }> {
  const { env, taskId, runnerIdentityUserId } = params;
  const baseContext = createServiceContext({ env });
  const user = await baseContext.repositories.users.getUserById(runnerIdentityUserId);

  if (!user) {
    return { status: "skipped", detail: "Runner identity no longer exists" };
  }

  const context = createServiceContext({ env, user });
  const claimed = await context.repositories.projectTasks.claimQueuedTask(
    taskId,
    runnerIdentityUserId,
  );

  if (!claimed) {
    return { status: "skipped", detail: "Task was not queued" };
  }

  const project = await context.repositories.workspaces.getProject(claimed.projectId);

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

  const conversationId = claimed.conversationId ?? projectTaskConversationId(taskId);
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
    const goal = await goalService.setGoal({
      owner: { conversationId },
      user,
      objective: buildGoalObjective(claimed),
      source: "user",
    });

    goalId = goal.id;
  } catch (error) {
    const detail = getErrorMessage(error);

    await blockTask(context, taskId, "run_failed", detail);

    return { status: "blocked", detail };
  }

  await context.repositories.projectTasks.updateTask(taskId, {
    conversationId,
    goalId,
  });

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

  try {
    const response = await handleCreateChatCompletions({
      env,
      context,
      user,
      request: {
        completion_id: conversationId,
        messages: [
          {
            role: "user",
            content: buildTaskPrompt({
              task: claimed,
              stageInstructions: buildStageInstructions(runtime.stage),
              contextNotes: buildContextNotes(claimed),
            }),
          },
        ],
        ...(runtime.model ? { model: runtime.model } : {}),
        mode: runtime.mode,
        stream: false,
        store: true,
        enabled_tools: runtime.enabledTools,
        require_approval_for: runtime.requireApprovalFor,
        tool_choice: "auto",
        metadata: { project_id: claimed.projectId },
        ...(runtime.agent?.system_prompt ? { system_prompt: runtime.agent.system_prompt } : {}),
      },
    });

    if (response instanceof Response) {
      throw new AssistantError(
        "A project task run unexpectedly streamed its response",
        ErrorType.INTERNAL_ERROR,
      );
    }
  } catch (error) {
    const detail = getErrorMessage(error);

    logger.error("Project task run failed", { taskId, error: detail });
    await blockTask(context, taskId, "run_failed", detail);
    await context.repositories.activities.updateActivity(activity.id, {
      status: "failed",
      summary: detail.slice(0, 200),
    });

    return { status: "blocked", detail };
  }

  const goal = goalId ? await goalService.getGoalById(goalId) : null;
  const projection = goal
    ? projectTaskStatusForGoal(goal)
    : { status: "review" as const, blockedReason: null };

  await context.repositories.projectTasks.updateTask(taskId, {
    status: projection.status,
    blockedReason: projection.blockedReason,
    blockedDetail: goal?.stopped_reason ?? null,
    tokensSpent: (claimed.tokensSpent ?? 0) + (goal?.tokens_spent ?? 0),
    ...(projection.status === "review" ? { completedAt: null } : {}),
  });
  await context.repositories.activities.updateActivity(activity.id, {
    status: projection.status === "blocked" ? "waiting" : "succeeded",
    summary: goal?.objective.slice(0, 200) ?? claimed.objective.slice(0, 200),
  });

  return projection.status === "blocked"
    ? { status: "blocked", detail: goal?.stopped_reason ?? undefined }
    : { status: "completed" };
}
