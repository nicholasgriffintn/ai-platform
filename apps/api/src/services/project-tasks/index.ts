import {
  isTerminalGoalStatus,
  isTerminalProjectTaskStatus,
  nextFlowStageId,
  PROJECT_TASK_DEFAULT_CONCURRENCY,
  PROJECT_TASK_DEFAULT_TOKEN_BUDGET,
  type CreateProjectTaskInput,
  type CreateLeanProofProjectTaskInput,
  leanProofResultSchema,
  type AnswerUserQuestionsInput,
  type ProjectFlow,
  type ProjectTask,
  type ProjectTaskActor,
  type ProjectTaskCriterion,
  type ProjectTaskSource,
  type ResolveProjectTaskToolApprovalInput,
  type UpdateProjectTaskInput,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ListProjectTaskFilters } from "~/repositories/ProjectTaskRepository";
import { cancelSandboxRunForProjectTask } from "~/services/apps/sandbox/runs";
import { GoalService } from "~/services/goals/GoalService";
import { formatOutput } from "~/services/outputs";
import { TaskService } from "~/services/tasks/TaskService";
import { requireProjectAccess } from "~/services/workspaces/access";
import { parseProjectFlow } from "~/services/workspaces/format";
import { AssistantError, ErrorType, getErrorMessage } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

import { resolveProjectTaskToolApproval } from "./approvals";
import { approveLatestProjectTaskCompletion } from "./completions";
import { leanProofRequestsMatch } from "./lean-proof-request";
import { answerProjectTaskQuestions, getPendingProjectTaskQuestions } from "./questions";
import { queueProjectTaskRun, reenqueueProjectTaskRun } from "./runner";
import { assertLeanProofTaskConfiguration, isLeanProofTask } from "./sandbox-runner";
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
        const goals = new GoalService(context.repositories.goals);
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

  if (task.sandboxRunId && task.runnerIdentityUserId) {
    settlements.push(
      cancelSandboxRunForProjectTask({
        context,
        taskId: task.id,
        projectId: task.projectId,
        sandboxRunId: task.sandboxRunId,
        runnerIdentityUserId: task.runnerIdentityUserId,
        reason: "The project task was cancelled.",
      }),
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

export async function listLeanProofProjectTasks(context: ServiceContext, projectId: string) {
  await requireProjectAccess(context, projectId);
  const tasks = await context.repositories.projectTasks.listProjectTasks(projectId, {
    includeDone: true,
  });

  return { tasks: tasks.filter(isLeanProofTask) };
}

export async function getLeanProofProjectTask(
  context: ServiceContext,
  projectId: string,
  taskId: string,
) {
  await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);

  if (!isLeanProofTask(task)) {
    throw new AssistantError("Proof task not found", ErrorType.NOT_FOUND, 404);
  }

  const [goal, outputRecord] = await Promise.all([
    task.goalId ? context.repositories.goals.getGoalById(task.goalId) : null,
    task.outputId ? context.repositories.outputs.getProjectOutput(projectId, task.outputId) : null,
  ]);
  const output = outputRecord ? formatOutput(outputRecord) : null;
  const parsedResult = leanProofResultSchema.safeParse(output?.content);

  return {
    task,
    goal,
    output,
    result: parsedResult.success ? parsedResult.data : null,
  };
}

export async function createAndStartLeanProofProjectTask(
  context: ServiceContext,
  projectId: string,
  input: CreateLeanProofProjectTaskInput,
  idempotencyKey: string,
) {
  const user = context.requireUser();
  const requestedTokenBudget = input.tokenBudget ?? PROJECT_TASK_DEFAULT_TOKEN_BUDGET;

  await requireProjectAccess(context, projectId);
  const findExisting = () =>
    context.repositories.projectTasks.getTaskByIdempotencyKey({
      projectId,
      createdByUserId: user.id,
      idempotencyKey,
    });
  const returnExisting = async (existing: ProjectTask) => {
    const existingRequest =
      existing.runner?.kind === "sandbox" && existing.runner.profile === "lean-proof"
        ? existing.runner.request
        : undefined;

    if (
      !leanProofRequestsMatch(existingRequest, input) ||
      existing.tokenBudget !== requestedTokenBudget
    ) {
      throw new AssistantError(
        "This idempotency key was already used for a different Lean proof request",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    if (
      existing.status === "backlog" ||
      (existing.status === "blocked" && existing.blockedReason === "dispatch_failed")
    ) {
      return startProjectTask(context, projectId, existing.id);
    }

    return { task: existing };
  };

  const existing = await findExisting();

  if (existing) {
    return returnExisting(existing);
  }

  const active = await context.repositories.projectTasks.countActiveTasks(projectId);

  if (active >= PROJECT_TASK_DEFAULT_CONCURRENCY) {
    throw new AssistantError(
      `This project already has ${PROJECT_TASK_DEFAULT_CONCURRENCY} tasks in flight. Wait for one to finish.`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const request = {
    targetPaths: input.targetPaths,
    declarations: input.declarations,
    objective: input.objective,
    acceptanceCriteria: input.acceptanceCriteria,
  };
  let created: { task: ProjectTask };

  try {
    created = await createProjectTask(
      context,
      projectId,
      {
        objective: request.objective,
        acceptanceCriteria: request.acceptanceCriteria.map((text) => ({ text })),
        expectedOutput: "A Lean proof result backed by compiler and kernel evidence",
        runner: { kind: "sandbox", profile: "lean-proof", request },
        stageId: null,
        tokenBudget: requestedTokenBudget,
      },
      { idempotencyKey },
    );
  } catch (error) {
    const raced = await findExisting();

    if (!raced) {
      throw error;
    }

    return returnExisting(raced);
  }

  return startProjectTask(context, projectId, created.task.id);
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
    await context.repositories.projectTasks.updateTask(taskId, {
      status: "blocked",
      blockedReason: "dispatch_failed",
      blockedDetail:
        `Your decision was saved, but the task could not resume: ${getErrorMessage(error)}`.slice(
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
  options: { source?: ProjectTaskSource; idempotencyKey?: string } = {},
) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId);
  const flow = parseProjectFlow(project.flow);

  await assertAssigneeIsMember(context, project.workspace_id, input.assigneeUserId);
  assertStageExists(flow, input.stageId);
  await assertDependenciesExist(context, projectId, null, input.dependsOnTaskIds);

  if (input.runner?.kind === "sandbox") {
    if (input.stageId) {
      throw new AssistantError(
        "Sandbox proof tasks do not use project flow stages",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    await assertLeanProofTaskConfiguration({
      context,
      project,
      task: { runner: input.runner },
    });
  }

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
    stageId:
      input.stageId === undefined
        ? input.runner?.kind === "sandbox"
          ? null
          : (flow?.stages[0]?.id ?? null)
        : input.stageId,
    tokenBudget: input.tokenBudget ?? null,
    idempotencyKey: options.idempotencyKey ?? null,
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

  if (input.runner !== undefined && (task.status === "queued" || task.status === "running")) {
    throw new AssistantError(
      "Stop this task before changing its runner",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const isActiveSandboxTask =
    isLeanProofTask(task) && (task.status === "queued" || task.status === "running");

  if (
    isActiveSandboxTask &&
    input.status !== undefined &&
    input.status !== task.status &&
    input.status !== "cancelled"
  ) {
    throw new AssistantError(
      "Cancel this proof task before moving it out of active execution",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (input.runner?.kind === "sandbox") {
    if (input.stageId ?? task.stageId) {
      throw new AssistantError(
        "Sandbox proof tasks do not use project flow stages",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    await assertLeanProofTaskConfiguration({ context, project, task: { runner: input.runner } });
  }

  if (input.status !== undefined) {
    assertProjectTaskTransition({ actor, from: task.status, to: input.status });
  }

  await assertAssigneeIsMember(context, project.workspace_id, input.assigneeUserId);
  assertStageExists(flow, input.stageId);
  await assertDependenciesExist(context, projectId, taskId, input.dependsOnTaskIds);

  const nextStatus = input.status ?? task.status;
  const isFinishing = isTerminalProjectTaskStatus(nextStatus) && nextStatus !== task.status;
  const updated = await context.repositories.projectTasks.updateTask(
    taskId,
    {
      ...input,
      acceptanceCriteria: withCriterionIds(input.acceptanceCriteria),
      ...(input.status !== undefined && input.status !== "blocked"
        ? { blockedReason: null, blockedDetail: null }
        : {}),
      ...(isFinishing ? { completedAt: new Date().toISOString() } : {}),
    },
    isActiveSandboxTask
      ? {
          expectedStatuses: [task.status],
          requireProjectionUnclaimed: input.status === "cancelled",
        }
      : {},
  );

  if (!updated) {
    if (isActiveSandboxTask) {
      throw new AssistantError(
        "This proof task changed while it was being updated. Refresh and try again.",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

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

  if (input.status === "cancelled" && task.status !== "cancelled") {
    await settleCancelledTaskResources(context, updated);
  }

  return { task: updated };
}

export async function startProjectTask(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  options: { approvalResolved?: boolean; approvedTools?: string[] } = {},
) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);
  const flow = parseProjectFlow(project.flow);

  if (task.status === "running") {
    return { task };
  }

  if (task.status === "queued" && task.dispatchTaskId) {
    await reenqueueProjectTaskRun(context, task);

    return { task };
  }

  if (task.status === "done" || task.status === "cancelled") {
    throw new AssistantError(
      "This task is finished. Reopen it before running it again.",
      ErrorType.PARAMS_ERROR,
      400,
    );
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

  const active = await context.repositories.projectTasks.countActiveTasks(projectId, task.id);

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
    stageId: isLeanProofTask(task) ? null : (task.stageId ?? flow?.stages[0]?.id ?? null),
    approvedTools: options.approvedTools,
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
  const nextStage = isLeanProofTask(task) ? null : nextFlowStageId(flow, task.stageId);
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

  if (task.status === "queued" || task.status === "running") {
    throw new AssistantError("Cancel this task before deleting it", ErrorType.CONFLICT_ERROR, 409);
  }

  const deleted = await context.repositories.projectTasks.deleteTask(taskId, task.status);

  if (!deleted) {
    throw new AssistantError(
      "This task changed before it could be deleted. Refresh and try again.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

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
