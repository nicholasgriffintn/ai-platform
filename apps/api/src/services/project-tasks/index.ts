import {
  isTerminalProjectTaskStatus,
  nextFlowStageId,
  PROJECT_TASK_DEFAULT_CONCURRENCY,
  type CreateProjectTaskInput,
  type AnswerUserQuestionsInput,
  type ProjectFlow,
  type ProjectTask,
  type ProjectTaskActor,
  type ProjectTaskCriterion,
  type ProjectTaskSource,
  type UpdateProjectTaskInput,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ListProjectTaskFilters } from "~/repositories/ProjectTaskRepository";
import { requireProjectAccess } from "~/services/workspaces/access";
import { parseProjectFlow } from "~/services/workspaces/format";
import { AssistantError, ErrorType, getErrorMessage } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { approveLatestProjectTaskCompletion } from "./completions";
import { answerProjectTaskQuestions, getPendingProjectTaskQuestions } from "./questions";
import { queueProjectTaskRun } from "./runner";
import { assertProjectTaskTransition } from "./transitions";

const POSITION_STEP = 1000;

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

function assertStageExists(flow: ProjectFlow | null, stageId: string | null | undefined): void {
  if (stageId === null || stageId === undefined) {
    return;
  }

  if (!flow?.stages.some((stage) => stage.id === stageId)) {
    throw new AssistantError("Unknown flow stage", ErrorType.PARAMS_ERROR, 400);
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
  await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);
  const [goal, pendingQuestions] = await Promise.all([
    task.goalId ? context.repositories.goals.getGoalById(task.goalId) : null,
    getPendingProjectTaskQuestions(context, task),
  ]);

  return { task, goal, pendingQuestions };
}

export async function respondToProjectTaskQuestions(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  input: AnswerUserQuestionsInput,
) {
  await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);

  await answerProjectTaskQuestions({ context, task, input });

  try {
    return await startProjectTask(context, projectId, taskId);
  } catch (error) {
    await context.repositories.projectTasks.updateTask(taskId, {
      status: "blocked",
      blockedReason: "dispatch_failed",
      blockedDetail:
        `Your answers were saved, but the task could not resume: ${getErrorMessage(error)}`.slice(
          0,
          500,
        ),
    });

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
  assertStageExists(flow, input.stageId);
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
    source: options.source ?? "user",
    createdByUserId: user.id,
    assigneeUserId: input.assigneeUserId ?? null,
    runner: input.runner ?? null,
    stageId: input.stageId ?? flow?.stages[0]?.id ?? null,
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
  const flow = parseProjectFlow(project.flow);
  const actor = options.actor ?? "user";

  if (input.status !== undefined) {
    assertProjectTaskTransition({ actor, from: task.status, to: input.status });
  }

  await assertAssigneeIsMember(context, project.workspace_id, input.assigneeUserId);
  assertStageExists(flow, input.stageId);
  await assertDependenciesExist(context, projectId, taskId, input.dependsOnTaskIds);

  const nextStatus = input.status ?? task.status;
  const isFinishing = isTerminalProjectTaskStatus(nextStatus) && nextStatus !== task.status;
  const updated = await context.repositories.projectTasks.updateTask(taskId, {
    ...input,
    acceptanceCriteria: withCriterionIds(input.acceptanceCriteria),
    ...(input.status !== undefined && input.status !== "blocked"
      ? { blockedReason: null, blockedDetail: null }
      : {}),
    ...(isFinishing ? { completedAt: new Date().toISOString() } : {}),
  });

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
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

  return { task: updated };
}

export async function startProjectTask(context: ServiceContext, projectId: string, taskId: string) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);
  const flow = parseProjectFlow(project.flow);

  if (task.status === "running" || (task.status === "queued" && task.dispatchTaskId)) {
    return { task };
  }

  if (task.status === "done" || task.status === "cancelled") {
    throw new AssistantError(
      "This task is finished. Reopen it before running it again.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const unmet = await resolveUnmetDependencies(context, task);

  if (unmet.length > 0) {
    await context.repositories.projectTasks.updateTask(taskId, {
      status: "blocked",
      blockedReason: "dependencies_unmet",
      blockedDetail:
        `Waiting on: ${unmet.map((dependency) => dependency.objective).join("; ")}`.slice(0, 500),
    });

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

  const queued = await queueProjectTaskRun({
    context,
    task,
    runnerIdentityUserId: user.id,
    stageId: task.stageId ?? flow?.stages[0]?.id ?? null,
  });

  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: "project.task.started",
    targetType: "project_task",
    targetId: taskId,
    metadata: { projectId, stageId: queued.stageId },
  });

  return { task: queued };
}

export async function acceptProjectTask(
  context: ServiceContext,
  projectId: string,
  taskId: string,
) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);

  if (task.status !== "review") {
    throw new AssistantError("Only a task in review can be accepted", ErrorType.PARAMS_ERROR, 400);
  }

  const flow = parseProjectFlow(project.flow);
  const nextStage = nextFlowStageId(flow, task.stageId);
  let updated: ProjectTask | null;

  if (nextStage) {
    const completions = approveLatestProjectTaskCompletion(task.completions, user.id);
    const reviewed = await context.repositories.projectTasks.updateTask(taskId, { completions });

    if (!reviewed) {
      throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
    }

    updated = await queueProjectTaskRun({
      context,
      task: reviewed,
      runnerIdentityUserId: user.id,
      stageId: nextStage,
    });
  } else {
    updated = await context.repositories.projectTasks.updateTask(taskId, {
      status: "done",
      blockedReason: null,
      blockedDetail: null,
      completions: approveLatestProjectTaskCompletion(task.completions, user.id),
      completedAt: new Date().toISOString(),
    });
  }

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: nextStage ? "project.task.stage_started" : "project.task.accepted",
    targetType: "project_task",
    targetId: taskId,
    metadata: { projectId, stageId: nextStage ?? task.stageId },
  });

  return { task: updated };
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

  return { flow: parseProjectFlow(project.flow) };
}

export async function setProjectFlow(
  context: ServiceContext,
  projectId: string,
  flow: ProjectFlow | null,
) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId, ["owner", "admin"]);

  if (flow) {
    const capabilities = await context.repositories.workspaces.listProjectCapabilities(projectId);
    const attachedAgents = new Set(
      capabilities
        .filter((capability) => capability.kind === "agent")
        .map((capability) => capability.capability_id),
    );
    const missing = flow.stages
      .map((stage) => stage.agentId)
      .filter((agentId): agentId is string => Boolean(agentId) && !attachedAgents.has(agentId));

    if (missing.length > 0) {
      throw new AssistantError(
        `Attach these agents to the project before using them in a flow: ${missing.join(", ")}`,
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
        flow.stages.flatMap((stage) =>
          stage.skillIds.filter((skillId) => !attachedSkills.has(skillId)),
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

  await context.repositories.workspaces.updateProject(projectId, {
    flow: flow ? JSON.stringify(flow) : null,
  });
  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: flow ? "project.flow.updated" : "project.flow.cleared",
    targetType: "project",
    targetId: projectId,
    metadata: { stageCount: flow?.stages.length ?? 0 },
  });

  return { flow };
}

export { listProjectTaskAttention } from "./attention";
