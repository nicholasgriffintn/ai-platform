import {
  isTerminalProjectTaskStatus,
  nextFlowStageId,
  PROJECT_TASK_DEFAULT_CONCURRENCY,
  PROJECT_TASK_DEFAULT_TOKEN_BUDGET,
  type CreateProjectTaskInput,
  type ProjectFlow,
  type ProjectTask,
  type ProjectTaskActor,
  type ProjectTaskSource,
  type ProjectTaskStatus,
  type UpdateProjectTaskInput,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ListProjectTaskFilters } from "~/repositories/ProjectTaskRepository";
import { requireProjectAccess } from "~/services/workspaces/access";
import { parseProjectFlow } from "~/services/workspaces/format";
import { AssistantError, ErrorType } from "~/utils/errors";

import { enqueueProjectTaskRun } from "./runner";
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

  return { task: await requireTask(context, projectId, taskId) };
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

  const maxPosition = await context.repositories.projectTasks.getMaxPosition(projectId);
  const task = await context.repositories.projectTasks.createTask({
    projectId,
    workspaceId: project.workspace_id,
    objective: input.objective,
    acceptance: input.acceptance ?? null,
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

  const nextStatus = input.status ?? task.status;
  const isFinishing = isTerminalProjectTaskStatus(nextStatus) && nextStatus !== task.status;
  const updated = await context.repositories.projectTasks.updateTask(taskId, {
    ...input,
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

  if (task.status === "running" || task.status === "queued") {
    return { task };
  }

  if (task.status === "done" || task.status === "cancelled") {
    throw new AssistantError(
      "This task is finished. Reopen it before running it again.",
      ErrorType.PARAMS_ERROR,
      400,
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

  const queued = await context.repositories.projectTasks.updateTask(taskId, {
    status: "queued",
    blockedReason: null,
    blockedDetail: null,
    runnerIdentityUserId: user.id,
    tokenBudget: task.tokenBudget ?? PROJECT_TASK_DEFAULT_TOKEN_BUDGET,
    runner: task.runner ?? {
      kind: "conversation",
      agentId: null,
      model: null,
      mode: null,
    },
  });

  if (!queued) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  await enqueueProjectTaskRun(context, queued, user.id);
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
  const nextStatus: ProjectTaskStatus = nextStage ? "backlog" : "done";
  const updated = await context.repositories.projectTasks.updateTask(taskId, {
    status: nextStatus,
    stageId: nextStage ?? task.stageId,
    blockedReason: null,
    blockedDetail: null,
    ...(nextStage ? {} : { completedAt: new Date().toISOString() }),
  });

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.audit.createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: nextStage ? "project.task.stage_advanced" : "project.task.accepted",
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
