import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { isTerminalGoalStatus } from "@ngriffin_uk/polychat-library-goals";
import {
  PROJECT_TASK_DEFAULT_CONCURRENCY,
  type CreateProjectTaskInput,
  type AnswerUserQuestionsInput,
  type ProjectFlow,
  type ProjectTask,
  type ProjectTaskActor,
  type ProjectTaskCriterion,
  type ProjectTaskSource,
  type ResolveProjectTaskToolApprovalInput,
  type UpdateProjectTaskInput,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createGoalService } from "~/modules/goals/application/createGoalService";
import type { ListProjectTaskFilters } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { TaskService } from "~/modules/tasks/application/TaskService";
import {
  listProjectDefaultTeammateIds,
  resolveProjectTeammateIds,
} from "~/modules/teammates/application/access";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import { parseProjectFlow } from "~/modules/workspaces/application/format";

import { initialProjectFlowExecution } from "../domain/flow-machine";
import { getProjectTaskActivity } from "./activity";
import { getPendingProjectTaskToolApproval, resolveProjectTaskToolApproval } from "./approvals";
import { reconcileTaskNotifications } from "./attention";
import { canReviewProjectFlowWait } from "./flow-authority";
import { driveProjectFlow, reloadFlowTask, recordProjectTaskResumeFailure } from "./flow-execution";
import { getProjectTaskInteraction } from "./interactions";
import { getProjectTaskPlanEvidence, getProjectTaskResumeCapability } from "./plan-evidence";
import { answerProjectTaskQuestions, getPendingProjectTaskQuestions } from "./questions";
import { validateFlowRecordBindings } from "./record-triggers";
import { queueProjectTaskRun } from "./runner";
export { resolveHumanFlowWait } from "./flow-execution";
import { assertProjectTaskTransition } from "./transitions";

const POSITION_STEP = 1000;
const logger = getLogger({ prefix: "services/project-tasks" });

async function settleCancelledTaskResources(
  context: ServiceContext,
  task: ProjectTask,
): Promise<void> {
  const settlements: Promise<unknown>[] = [
    context.repositories.activities.cancelActiveActivitiesByGroup("project_task", task.id),
  ];

  const dispatchTaskId = task.dispatchTaskId;

  if (dispatchTaskId) {
    settlements.push(
      new TaskService(context.env, context.repositories.tasks).cancelTask(dispatchTaskId),
    );
  }

  const goalId = task.goalId;

  if (goalId) {
    settlements.push(
      (async () => {
        const goals = createGoalService(context);
        const goal = await goals.getGoalById(goalId);

        if (goal && !isTerminalGoalStatus(goal.status)) {
          await goals.transition({
            goalId: goal.id,
            actor: "user",
            status: "cleared",
            reason: "The project task was cancelled.",
          });
        }
      })(),
    );
  }

  const results = await Promise.allSettled(settlements);
  const failures = results.filter((result) => result.status === "rejected");

  if (failures.length > 0) {
    logger.warn("Project task was cancelled but related runtime state did not all settle", {
      taskId: task.id,
      failureCount: failures.length,
    });
  }
}

async function requireTask(
  context: ServiceContext,
  projectId: string,
  taskId: string,
): Promise<ProjectTask> {
  const task = await context.repositories.projectTasks.getTaskById(taskId);

  if (!task || task.projectId !== projectId) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  return task;
}

async function assertAssigneeIsMember(
  context: ServiceContext,
  workspaceId: string,
  assigneeUserId: number | null | undefined,
): Promise<void> {
  if (assigneeUserId === null || assigneeUserId === undefined) {
    return;
  }

  const membership = await context.repositories.workspaces.getMembership(
    workspaceId,
    assigneeUserId,
  );

  if (!membership) {
    throw new AssistantError(
      "You can only assign a task to a member of this workspace",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}

function assertNodeExists(flow: ProjectFlow | null, nodeId: string | null | undefined): void {
  if (nodeId === null || nodeId === undefined) {
    return;
  }

  if (!flow?.nodes.some((node) => node.id === nodeId)) {
    throw new AssistantError("Unknown flow step", ErrorType.PARAMS_ERROR, 400);
  }
}

function withCriterionIds(
  criteria: { id?: string; text: string }[] | undefined,
): ProjectTaskCriterion[] | undefined {
  if (criteria === undefined) {
    return undefined;
  }

  return criteria.map((criterion) => ({
    id: criterion.id ?? generateId(),
    text: criterion.text,
  }));
}

async function assertDependenciesExist(
  context: ServiceContext,
  projectId: string,
  taskId: string | null,
  dependsOnTaskIds: string[] | undefined,
): Promise<void> {
  if (!dependsOnTaskIds?.length) {
    return;
  }

  if (taskId && dependsOnTaskIds.includes(taskId)) {
    throw new AssistantError("A task cannot depend on itself", ErrorType.PARAMS_ERROR, 400);
  }

  const tasks = await context.repositories.projectTasks.listProjectTasks(projectId, {
    includeDone: true,
  });
  const known = new Set(tasks.map((task) => task.id));
  const missing = dependsOnTaskIds.filter((id) => !known.has(id));

  if (missing.length > 0) {
    throw new AssistantError(
      `These tasks are not on this board: ${missing.join(", ")}`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}

export async function resolveUnmetDependencies(
  context: ServiceContext,
  task: ProjectTask,
): Promise<ProjectTask[]> {
  if (task.dependsOnTaskIds.length === 0) {
    return [];
  }

  const tasks = await context.repositories.projectTasks.listProjectTasks(task.projectId, {
    includeDone: true,
  });
  const byId = new Map(tasks.map((candidate) => [candidate.id, candidate]));

  return task.dependsOnTaskIds
    .map((id) => byId.get(id))
    .filter(
      (candidate): candidate is ProjectTask => Boolean(candidate) && candidate.status !== "done",
    );
}

export async function listProjectTasks(
  context: ServiceContext,
  projectId: string,
  filters: ListProjectTaskFilters = {},
) {
  const { project } = await requireProjectAccess(context, projectId);
  const tasks = await context.repositories.projectTasks.listProjectTasks(projectId, filters);

  return { tasks, flow: parseProjectFlow(project.flow) };
}

export async function getProjectTask(context: ServiceContext, projectId: string, taskId: string) {
  const { role } = await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);
  const [goal, pendingQuestions, pendingApproval, interaction, flowWait] = await Promise.all([
    task.goalId ? context.repositories.goals.getGoalById(task.goalId) : null,
    getPendingProjectTaskQuestions(context, task),
    getPendingProjectTaskToolApproval(context, task),
    getProjectTaskInteraction(context, task),
    task.flowExecution.waitId
      ? context.repositories.projectFlows.getWait(task.flowExecution.waitId)
      : null,
  ]);
  const activity = await getProjectTaskActivity(context, task, goal, interaction);
  const plan = await getProjectTaskPlanEvidence(context, task);

  return {
    task,
    goal,
    pendingQuestions,
    pendingApproval,
    interaction,
    activity,
    plan,
    flowWait,
    canRespondToFlowWait: Boolean(
      flowWait?.status === "pending" &&
      canReviewProjectFlowWait(context.requireUser().id, role, flowWait),
    ),
  };
}

export async function respondToProjectTaskQuestions(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  input: AnswerUserQuestionsInput,
) {
  await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);

  const { toolCallId } = await answerProjectTaskQuestions({ context, task, input });

  try {
    return await startProjectTask(context, projectId, taskId, {
      interaction: {
        toolName: "ask_user",
        response: { interactionId: toolCallId, answers: input.answers },
      },
    });
  } catch (error) {
    const blocked = await recordProjectTaskResumeFailure(
      context,
      task,
      `Your answers were saved, but the task could not resume: ${getErrorMessage(error)}`,
    );

    if (blocked) {
      await reconcileTaskNotifications(context, blocked);
    }

    throw error;
  }
}

export async function respondToProjectTaskToolApproval(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  input: ResolveProjectTaskToolApprovalInput,
) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);
  const approval = await resolveProjectTaskToolApproval({ context, task, input });

  try {
    const resumed = await startProjectTask(context, projectId, taskId, {
      approvalResolved: true,
      approvedTools: approval.resolution === "approved" ? [approval.toolName] : [],
      interaction: {
        toolName: approval.toolName,
        response: {
          interactionId: input.interactionId,
          resolution: input.resolution,
        },
      },
    });

    await context.repositories.audit.createRecord({
      workspaceId: project.workspace_id,
      actorUserId: user.id,
      action: "project.task.tool_approval_resolved",
      targetType: "project_task",
      targetId: taskId,
      metadata: {
        projectId,
        toolName: approval.toolName,
        resolution: approval.resolution,
      },
    });

    return resumed;
  } catch (error) {
    const blocked = await recordProjectTaskResumeFailure(
      context,
      task,
      `Your decision was saved, but the task could not resume: ${getErrorMessage(error)}`,
    );

    if (blocked) {
      await reconcileTaskNotifications(context, blocked);
    }

    throw error;
  }
}

export async function createProjectTask(
  context: ServiceContext,
  projectId: string,
  input: CreateProjectTaskInput,
  options: { source?: ProjectTaskSource } = {},
) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId);
  const flow = parseProjectFlow(project.flow);

  await assertAssigneeIsMember(context, project.workspace_id, input.assigneeUserId);
  assertNodeExists(flow, input.nodeId);
  await assertDependenciesExist(context, projectId, null, input.dependsOnTaskIds);

  const maxPosition = await context.repositories.projectTasks.getMaxPosition(projectId);
  const task = await context.repositories.projectTasks.createTask({
    projectId,
    workspaceId: project.workspace_id,
    objective: input.objective,
    acceptanceCriteria: withCriterionIds(input.acceptanceCriteria) ?? [],
    expectedOutput: input.expectedOutput ?? null,
    context: input.context ?? null,
    constraints: input.constraints ?? null,
    dependsOnTaskIds: input.dependsOnTaskIds ?? [],
    requireApprovalFor: input.requireApprovalFor ?? [],
    originConversationId: input.originConversationId ?? null,
    source: options.source ?? "user",
    createdByUserId: user.id,
    assigneeUserId: input.assigneeUserId ?? null,
    runner: input.runner ?? null,
    nodeId: input.nodeId ?? flow?.entryNodeId ?? null,
    flowSnapshot: flow,
    tokenBudget: input.tokenBudget ?? null,
    position: maxPosition + POSITION_STEP,
  });

  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: "project.task.created",
    targetType: "project_task",
    targetId: task.id,
    metadata: { projectId, source: task.source },
  });

  await reconcileTaskNotifications(context, task);

  return { task };
}

export async function updateProjectTask(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  input: UpdateProjectTaskInput,
  options: { actor?: ProjectTaskActor } = {},
) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);
  const flow = task.flowSnapshot;
  const actor = options.actor ?? "user";

  const planFields = [
    "objective",
    "acceptanceCriteria",
    "expectedOutput",
    "context",
    "constraints",
    "dependsOnTaskIds",
    "requireApprovalFor",
    "runner",
    "nodeId",
  ] as const;
  const changesPlan = planFields.some((field) => input[field] !== undefined);

  if (
    changesPlan &&
    (task.status !== "backlog" ||
      task.flowExecution.steps > 0 ||
      task.runnerIdentityUserId !== null)
  ) {
    throw new AssistantError(
      "Only a pending plan can be edited. Cancel this task and create a new task to change executed work.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (
    input.status === "backlog" &&
    task.status !== "backlog" &&
    (task.status === "done" || task.runId || task.completions.length > 0)
  ) {
    throw new AssistantError(
      "This plan has execution evidence. Create a new task instead of rewriting its history.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (input.status !== undefined) {
    assertProjectTaskTransition({ actor, from: task.status, to: input.status });
    if (
      input.status !== task.status &&
      input.status !== "backlog" &&
      input.status !== "cancelled"
    ) {
      throw new AssistantError(
        "The flow controls execution, review and completion",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    if (
      input.status !== "cancelled" &&
      input.status !== task.status &&
      task.flowExecution.steps > 0
    ) {
      throw new AssistantError(
        "Use the current flow wait to continue executed work",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }
  }

  await assertAssigneeIsMember(context, project.workspace_id, input.assigneeUserId);
  assertNodeExists(flow, input.nodeId);
  await assertDependenciesExist(context, projectId, taskId, input.dependsOnTaskIds);

  let updated: ProjectTask | null;

  if (input.status === "cancelled" && task.status !== "cancelled") {
    const committed = await context.repositories.projectFlows.transition({
      task,
      execution: { ...task.flowExecution, waitId: null },
      actorUserId: user.id,
      status: "cancelled",
      kind: "cancelled",
    });

    if (!committed) {
      throw new AssistantError(
        "The task changed before it could be cancelled",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    updated = await reloadFlowTask(context, taskId);
  } else {
    updated = await context.repositories.projectTasks.updateTask(
      taskId,
      {
        ...input,
        acceptanceCriteria: withCriterionIds(input.acceptanceCriteria),
        ...(input.nodeId !== undefined
          ? {
              nodeId: input.nodeId ?? task.flowSnapshot.entryNodeId,
              flowExecution: initialProjectFlowExecution(
                task.flowSnapshot,
                input.nodeId ?? task.flowSnapshot.entryNodeId,
              ),
            }
          : {}),
        ...(input.status !== undefined && input.status !== "blocked"
          ? { blockedReason: null, blockedDetail: null }
          : {}),
      },
      undefined,
      changesPlan ? task.flowRevision : undefined,
    );
  }

  if (!updated) {
    throw new AssistantError(
      "The task changed before the update was saved",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (input.status !== undefined && input.status !== task.status) {
    await context.repositories.audit.createRecord({
      workspaceId: project.workspace_id,
      actorUserId: user.id,
      action: "project.task.status_changed",
      targetType: "project_task",
      targetId: taskId,
      metadata: { projectId, from: task.status, to: input.status, actor },
    });
  }

  if (input.status === "cancelled" && task.status !== "cancelled") {
    await settleCancelledTaskResources(context, task);
  }

  await reconcileTaskNotifications(context, updated);

  return { task: updated };
}

export async function startProjectTask(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  options: {
    approvalResolved?: boolean;
    approvedTools?: string[];
    interaction?: { toolName: string; response: Record<string, unknown> };
  } = {},
) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);
  const flow = task.flowSnapshot;

  if (task.status === "running" || (task.status === "queued" && task.dispatchTaskId)) {
    return { task };
  }

  if (task.status === "done" || task.status === "cancelled") {
    throw new AssistantError(
      "This task is finished. Create a new task to run the work again.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (task.status === "blocked" && task.blockedReason === "run_failed") {
    const unsafeRunIds = await context.repositories.connectorOperationApprovals.listConsumedRunIds(
      task.runId ? [task.runId] : [],
    );
    const resume = getProjectTaskResumeCapability(task, unsafeRunIds);

    if (!resume.supported) {
      throw new AssistantError(
        resume.reason ?? "This step cannot be retried safely",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }
  }

  if (task.blockedReason === "awaiting_approval" && !options.approvalResolved) {
    throw new AssistantError(
      "Respond to the pending tool approval before continuing this task.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const unmet = await resolveUnmetDependencies(context, task);

  if (unmet.length > 0) {
    const committed = await context.repositories.projectFlows.transition({
      task,
      execution: task.flowExecution,
      actorUserId: context.requireUser().id,
      kind: "failed",
      status: "blocked",
      blockedReason: "dependencies_unmet",
      detail: `Waiting on: ${unmet.map((dependency) => dependency.objective).join("; ")}`.slice(
        0,
        500,
      ),
    });

    if (committed) {
      const blocked = await reloadFlowTask(context, taskId);

      await reconcileTaskNotifications(context, blocked);
    }

    throw new AssistantError(
      `This task depends on work that is not done yet: ${unmet
        .map((dependency) => dependency.objective)
        .join("; ")}`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const active = await context.repositories.projectTasks.countActiveTasks(projectId);

  if (active >= PROJECT_TASK_DEFAULT_CONCURRENCY) {
    throw new AssistantError(
      `This project already has ${PROJECT_TASK_DEFAULT_CONCURRENCY} tasks in flight. Wait for one to finish.`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const queued = !task.flowExecution.waitId
    ? await driveProjectFlow(context, task)
    : await queueProjectTaskRun({
        context,
        task,
        runnerIdentityUserId: task.runnerIdentityUserId ?? user.id,
        nodeId: task.nodeId ?? flow?.entryNodeId ?? null,
        approvedTools: options.approvedTools,
        interaction: options.interaction,
      });

  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: "project.task.started",
    targetType: "project_task",
    targetId: taskId,
    metadata: { projectId, nodeId: queued.nodeId },
  });

  return { task: queued };
}

export async function getProjectTaskFlowHistory(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  after: number,
) {
  await requireProjectAccess(context, projectId);
  await requireTask(context, projectId, taskId);

  return context.repositories.projectFlows.history(taskId, after, {
    projectId,
    actorUserId: context.requireUser().id,
  });
}

export async function deleteProjectTask(
  context: ServiceContext,
  projectId: string,
  taskId: string,
) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);

  if (task.status === "running") {
    throw new AssistantError("Stop this task before deleting it", ErrorType.CONFLICT_ERROR, 409);
  }

  if (task.flowExecution.steps > 0 || task.runId || task.completions.length > 0) {
    throw new AssistantError(
      "Cancel this task to retain its execution evidence. Only an unstarted plan can be deleted.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await context.repositories.projectTasks.deleteTask(taskId);
  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: "project.task.deleted",
    targetType: "project_task",
    targetId: taskId,
    metadata: { projectId },
  });

  return { success: true };
}

export async function getProjectFlow(context: ServiceContext, projectId: string) {
  const { project } = await requireProjectAccess(context, projectId);
  const triggers = await context.repositories.projectRecordTriggers.list(projectId);

  return {
    flow: parseProjectFlow(project.flow),
    triggerStates: triggers.map((trigger) => ({
      id: trigger.configuration.id,
      tableId: trigger.tableId,
      name: trigger.configuration.name,
      cursor: trigger.cursor,
      revision: trigger.revision,
      enabled: trigger.enabled,
      error: trigger.error,
      updatedAt: trigger.updatedAt,
    })),
  };
}

export async function setProjectFlow(
  context: ServiceContext,
  projectId: string,
  flow: ProjectFlow | null,
) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId, ["owner", "admin"]);

  if (flow) {
    await validateFlowRecordBindings(context, projectId, flow);
    const [capabilities, defaultTeammateIds] = await Promise.all([
      context.repositories.workspaces.listProjectCapabilities(projectId),
      listProjectDefaultTeammateIds(context, project.workspace_id),
    ]);
    const availableTeammates = new Set(
      resolveProjectTeammateIds({ capabilities, defaultTeammateIds }),
    );
    const missing = flow.nodes
      .flatMap((node) => (node.type === "agent" ? [node.teammateId] : []))
      .filter(
        (teammateId): teammateId is string =>
          Boolean(teammateId) && !availableTeammates.has(teammateId),
      );

    if (missing.length > 0) {
      throw new AssistantError(
        `These teammates are not available in this project: ${missing.join(", ")}`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const attachedSkills = new Set(
      capabilities
        .filter((capability) => capability.kind === "skill")
        .map((capability) => capability.capability_id),
    );
    const missingSkills = [
      ...new Set(
        flow.nodes.flatMap((node) =>
          node.type === "agent"
            ? node.skillIds.filter((skillId) => !attachedSkills.has(skillId))
            : [],
        ),
      ),
    ];

    if (missingSkills.length > 0) {
      throw new AssistantError(
        `Attach these skills to the project before using them in a flow: ${missingSkills.join(", ")}`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  if (!(await context.repositories.projectRecordTriggers.saveFlow(projectId, user.id, flow))) {
    throw new AssistantError("Project flow permissions changed", ErrorType.CONFLICT_ERROR, 409);
  }

  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: flow ? "project.flow.updated" : "project.flow.cleared",
    targetType: "project",
    targetId: projectId,
    metadata: { nodeCount: flow?.nodes.length ?? 0 },
  });

  return getProjectFlow(context, projectId);
}

export { listProjectTaskAttention } from "./attention";
