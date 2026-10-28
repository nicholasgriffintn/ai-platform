import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { isTerminalGoalStatus } from "@ngriffin_uk/polychat-library-goals";
import {
  isTerminalProjectTaskStatus,
  createProjectTaskSchema,
  updateProjectTaskSchema,
  nextFlowStageId,
  PROJECT_TASK_DEFAULT_CONCURRENCY,
  PROJECT_TASK_MAX_DEPTH,
  type CreateProjectTaskInput,
  type ProjectTaskDetails,
  type ProjectTaskRunner,
  type ProjectTaskSummary,
  type WorkActor,
  type AnswerUserQuestionsInput,
  type ProjectFlow,
  type ProjectTask,
  type ProjectTaskActor,
  type ProjectTaskCriterion,
  type ProjectTaskSource,
  type ResolveProjectTaskToolApprovalInput,
  type UpdateProjectTaskInput,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, withGeneratedIds } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ActivityRepository } from "~/modules/activity/infrastructure/ActivityRepository";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { ConnectorOperationApprovalRepository } from "~/modules/connectors/infrastructure/ConnectorOperationApprovalRepository";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { createGoalService } from "~/modules/goals/application/createGoalService";
import { GoalRepository } from "~/modules/goals/infrastructure/GoalRepository";
import { stopMachineAgentTurn } from "~/modules/machines/application/agent-turn";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import type { ListProjectTaskFilters } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import {
  listProjectDefaultTeammateIds,
  resolveProjectTeammateIds,
} from "~/modules/teammates/application/access";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import { parseProjectFlow } from "~/modules/workspaces/application/format";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { getProjectTaskActivity } from "./activity";
import { getPendingProjectTaskToolApproval, resolveProjectTaskToolApproval } from "./approvals";
import { reconcileTaskNotifications } from "./attention";
import { approveLatestProjectTaskCompletion } from "./completions";
import { getProjectTaskInteraction } from "./interactions";
import { recordProjectTaskRetrospective } from "./plan-checks";
import { getProjectTaskPlanEvidence, getProjectTaskResumeCapability } from "./plan-evidence";
import { answerProjectTaskQuestions, getPendingProjectTaskQuestions } from "./questions";
import { queueProjectTaskRun, releaseReadyDependentTasks } from "./runner";
import { assertTaskSourcesAvailable } from "./source-context";
import { listTaskThread } from "./thread";
import { assertProjectTaskTransition } from "./transitions";

const POSITION_STEP = 1000;
const logger = getLogger({ prefix: "services/project-tasks" });

async function settleCancelledTaskResources(
  context: ServiceContext,
  task: ProjectTask,
): Promise<void> {
  const settlements: Promise<unknown>[] = [
    context.repositories
      .get(ActivityRepository)
      .cancelActiveActivitiesByGroup("project_task", task.id),
  ];

  const dispatchTaskId = task.dispatchTaskId;

  if (dispatchTaskId) {
    settlements.push(
      new TaskService(context.env, context.repositories.get(TaskRepository)).cancelTask(
        dispatchTaskId,
      ),
    );
  }

  const runId = task.runId;
  const conversationId = task.conversationId;

  if (runId && conversationId) {
    settlements.push(
      (async () => {
        const run = await context.repositories.get(ConversationRunRepository).getById(runId);
        const machineId = run?.provenance?.machineId;

        if (machineId) {
          await stopMachineAgentTurn(context, machineId, conversationId);
        }
      })(),
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
  const task = await context.repositories.get(ProjectTaskRepository).getTaskById(taskId);

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

  const membership = await context.repositories
    .get(WorkspaceRepository)
    .getMembership(workspaceId, assigneeUserId);

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

async function recordRetrospectiveQuietly(
  context: ServiceContext,
  task: ProjectTask,
  finishedAs: "done" | "cancelled",
): Promise<void> {
  try {
    await recordProjectTaskRetrospective(context, task, finishedAs);
  } catch (error) {
    logger.warn("Could not record the task retrospective", {
      taskId: task.id,
      error: getErrorMessage(error),
    });
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

  const tasks = await context.repositories.get(ProjectTaskRepository).listProjectTasks(projectId, {
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

const DEFAULT_RUNNER: ProjectTaskRunner = {
  kind: "conversation",
  teammateId: null,
  model: null,
  mode: null,
};

async function assertTeammateAvailableInProject(
  context: ServiceContext,
  projectId: string,
  workspaceId: string,
  teammateId: string,
): Promise<void> {
  const [capabilities, defaultTeammateIds] = await Promise.all([
    context.repositories.get(WorkspaceRepository).listProjectCapabilities(projectId),
    listProjectDefaultTeammateIds(context, workspaceId),
  ]);

  if (!resolveProjectTeammateIds({ capabilities, defaultTeammateIds }).includes(teammateId)) {
    throw new AssistantError(
      "That teammate is not available in this project. Add it to the project on the Team page first.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}

async function resolveOwnerFields(
  context: ServiceContext,
  task: { projectId: string; workspaceId: string; runner: ProjectTaskRunner | null },
  owner: WorkActor | null,
): Promise<{ runner: ProjectTaskRunner | null; assigneeUserId: number | null }> {
  if (!owner) {
    return {
      runner: task.runner ? { ...task.runner, teammateId: null } : null,
      assigneeUserId: null,
    };
  }

  if (owner.type === "teammate") {
    await assertTeammateAvailableInProject(context, task.projectId, task.workspaceId, owner.id);

    return {
      runner: { ...(task.runner ?? DEFAULT_RUNNER), teammateId: owner.id },
      assigneeUserId: null,
    };
  }

  await assertAssigneeIsMember(context, task.workspaceId, owner.userId);

  return {
    runner: task.runner ? { ...task.runner, teammateId: null } : null,
    assigneeUserId: owner.userId,
  };
}

export async function assertParentAllowed(
  context: ServiceContext,
  projectId: string,
  taskId: string | null,
  parentTaskId: string | null | undefined,
): Promise<void> {
  if (!parentTaskId) {
    return;
  }

  let depth = 1;
  let current: string | null = parentTaskId;

  while (current) {
    if (current === taskId) {
      throw new AssistantError("A task cannot sit under itself", ErrorType.PARAMS_ERROR, 400);
    }

    const ancestor = await context.repositories.get(ProjectTaskRepository).getTaskById(current);

    if (!ancestor || ancestor.projectId !== projectId) {
      throw new AssistantError("The parent task is not on this board", ErrorType.PARAMS_ERROR, 400);
    }

    depth += 1;
    current = ancestor.parentTaskId;
  }

  if (depth > PROJECT_TASK_MAX_DEPTH) {
    throw new AssistantError(
      `Sub-tasks can go ${PROJECT_TASK_MAX_DEPTH} levels deep. Split this into a sibling task instead.`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }
}

export function summariseTask(task: ProjectTask): ProjectTaskSummary {
  return {
    id: task.id,
    key: task.key,
    kind: task.kind,
    objective: task.objective,
    status: task.status,
    priority: task.priority,
    owner: task.owner,
    projectId: task.projectId,
  };
}

export async function resolveUnmetDependencies(
  context: ServiceContext,
  task: ProjectTask,
): Promise<ProjectTask[]> {
  if (task.dependsOnTaskIds.length === 0) {
    return [];
  }

  const tasks = await context.repositories
    .get(ProjectTaskRepository)
    .listProjectTasks(task.projectId, {
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
  const tasks = await context.repositories
    .get(ProjectTaskRepository)
    .listProjectTasks(projectId, filters);

  return { tasks, flow: parseProjectFlow(project.flow) };
}

export async function getProjectTask(context: ServiceContext, projectId: string, taskId: string) {
  const { project } = await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);
  const [goal, pendingQuestions, pendingApproval, interaction] = await Promise.all([
    task.goalId ? context.repositories.get(GoalRepository).getGoalById(task.goalId) : null,
    getPendingProjectTaskQuestions(context, task),
    getPendingProjectTaskToolApproval(context, task),
    getProjectTaskInteraction(context, task),
  ]);
  const [activity, plan, children, links, runs] = await Promise.all([
    getProjectTaskActivity(context, task, goal, interaction),
    getProjectTaskPlanEvidence(context, task, parseProjectFlow(project.flow)),
    context.repositories.get(ProjectTaskRepository).listChildren(task.id),
    context.repositories.get(ProjectTaskRepository).listLinks(task.id),
    context.repositories.get(ConversationRunRepository).listForProjectTask(projectId, task.id),
  ]);
  const outputs = await context.repositories
    .get(OutputRepository)
    .listProjectOutputsForTaskRuns(projectId, runs);
  const linkedTasks = await context.repositories
    .get(ProjectTaskRepository)
    .listTasksByIds([
      ...new Set(
        links.map((link) => (link.fromTaskId === task.id ? link.toTaskId : link.fromTaskId)),
      ),
    ]);
  const linkedById = new Map(linkedTasks.map((linked) => [linked.id, linked]));

  return {
    task,
    goal,
    pendingQuestions,
    pendingApproval,
    interaction,
    activity,
    plan,
    children: children.map(summariseTask),
    links: links.flatMap((link) => {
      const outgoing = link.fromTaskId === task.id;
      const other = linkedById.get(outgoing ? link.toTaskId : link.fromTaskId);

      return other && other.workspaceId === task.workspaceId
        ? [
            {
              ...link,
              direction: outgoing ? ("outgoing" as const) : ("incoming" as const),
              task: summariseTask(other),
            },
          ]
        : [];
    }),
    outputs: outputs.map((output) => ({
      id: output.id,
      title: output.title,
      kind: output.kind,
      status: output.status,
    })),
  };
}

export async function getProjectTaskThread(
  context: ServiceContext,
  projectId: string,
  taskId: string,
) {
  await requireProjectAccess(context, projectId);

  return { thread: await listTaskThread(context, await requireTask(context, projectId, taskId)) };
}

export async function sendProjectTaskAgain(
  context: ServiceContext,
  projectId: string,
  taskId: string,
): Promise<ProjectTask> {
  await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);

  if ((task.status !== "queued" && task.status !== "running") || !task.dispatchTaskId) {
    throw new AssistantError(
      "Only a queued or running task can be sent again",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const tasks = context.repositories.get(TaskRepository);

  await tasks.releaseExpiredLease(task.dispatchTaskId);

  const dispatch = await tasks.getTaskById(task.dispatchTaskId);

  if (dispatch?.status === "running") {
    throw new AssistantError(
      "This task is still running. It can be sent again once its worker stops.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (dispatch?.status !== "pending" && dispatch?.status !== "queued") {
    throw new AssistantError(
      "This task's run has already ended. Cancel it and run it again.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await new TaskService(context.env, tasks).dispatchTask(dispatch);

  return task;
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
    const blocked = await context.repositories.get(ProjectTaskRepository).updateTask(taskId, {
      status: "blocked",
      blockedReason: "dispatch_failed",
      blockedDetail:
        `Your answers were saved, but the task could not resume: ${getErrorMessage(error)}`.slice(
          0,
          500,
        ),
    });

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
          option: input.resolution === "approved" ? "Approve" : "Reject",
        },
      },
    });

    await context.repositories.get(AuditRepository).createRecord({
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
    const blocked = await context.repositories.get(ProjectTaskRepository).updateTask(taskId, {
      status: "blocked",
      blockedReason: "dispatch_failed",
      blockedDetail:
        `Your decision was saved, but the task could not resume: ${getErrorMessage(error)}`.slice(
          0,
          500,
        ),
    });

    if (blocked) {
      await reconcileTaskNotifications(context, blocked);
    }

    throw error;
  }
}

export async function createProjectTask(
  context: ServiceContext,
  projectId: string,
  unvalidatedInput: CreateProjectTaskInput,
  options: {
    source?: ProjectTaskSource;
    id?: string;
    flowSnapshot?: ProjectFlow;
    executionProfile?: "diff_review";
    details?: ProjectTaskDetails;
  } = {},
) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId);
  const flow = options.flowSnapshot ?? parseProjectFlow(project.flow);

  const input = createProjectTaskSchema.parse(unvalidatedInput);

  if (options.id) {
    const existing = await context.repositories.get(ProjectTaskRepository).getTaskById(options.id);

    if (existing) {
      if (existing.projectId !== projectId || existing.createdByUserId !== user.id) {
        throw new AssistantError(
          "Task identity belongs to another scope",
          ErrorType.FORBIDDEN,
          403,
        );
      }

      return { task: existing };
    }
  }

  await assertTaskSourcesAvailable(context, projectId, input.context?.sourceIds);

  await assertAssigneeIsMember(context, project.workspace_id, input.assigneeUserId);
  assertStageExists(flow, input.stageId);
  await assertDependenciesExist(context, projectId, null, input.dependsOnTaskIds);
  await assertParentAllowed(context, projectId, null, input.parentTaskId);

  const ownership =
    input.owner !== undefined
      ? await resolveOwnerFields(
          context,
          { projectId, workspaceId: project.workspace_id, runner: input.runner ?? null },
          input.owner,
        )
      : { runner: input.runner ?? null, assigneeUserId: input.assigneeUserId ?? null };
  const [maxPosition, numbering] = await Promise.all([
    context.repositories.get(ProjectTaskRepository).getMaxPosition(projectId),
    context.repositories.get(ProjectTaskRepository).allocateTaskNumber(projectId),
  ]);
  const { task, created } = await context.repositories.get(ProjectTaskRepository).createTask({
    number: numbering.number,
    key: numbering.key,
    kind: input.kind ?? "task",
    description: input.description ?? null,
    priority: input.priority ?? "none",
    parentTaskId: input.parentTaskId ?? null,
    startAt: input.startAt ?? null,
    dueAt: input.dueAt ?? null,
    reviewer: input.reviewer ?? null,
    details: options.details ?? null,
    id: options.id,
    executionProfile: options.executionProfile,
    projectId,
    workspaceId: project.workspace_id,
    objective: input.objective,
    acceptanceCriteria: withCriterionIds(input.acceptanceCriteria) ?? [],
    assumptions: withGeneratedIds(input.assumptions ?? []),
    killConditions: withGeneratedIds(input.killConditions ?? []),
    expectedOutput: input.expectedOutput ?? null,
    context: input.context ?? null,
    constraints: input.constraints ?? null,
    dependsOnTaskIds: input.dependsOnTaskIds ?? [],
    requireApprovalFor: input.requireApprovalFor ?? [],
    originConversationId: input.originConversationId ?? null,
    source: options.source ?? "user",
    createdByUserId: user.id,
    assigneeUserId: ownership.assigneeUserId,
    runner: ownership.runner,
    stageId: input.stageId ?? flow?.stages[0]?.id ?? null,
    flowSnapshot: flow,
    tokenBudget: input.tokenBudget ?? null,
    position: maxPosition + POSITION_STEP,
  });

  if (!created) {
    return { task };
  }

  await context.repositories.get(AuditRepository).createRecord({
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
  unvalidatedInput: UpdateProjectTaskInput,
  options: { actor?: ProjectTaskActor } = {},
) {
  const user = context.requireUser();

  const { owner, ...input } = updateProjectTaskSchema.parse(unvalidatedInput);
  const { project } = await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);

  if (owner !== undefined && (task.status === "running" || task.status === "queued")) {
    throw new AssistantError(
      "Wait for the current run to finish before handing this task to someone else.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const ownership =
    owner !== undefined
      ? await resolveOwnerFields(
          context,
          { projectId, workspaceId: project.workspace_id, runner: task.runner },
          owner,
        )
      : {};
  const flow = task.flowSnapshot ?? parseProjectFlow(project.flow);
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
    "stageId",
  ] as const;
  const changesPlan = planFields.some((field) => input[field] !== undefined);

  if (changesPlan && task.executionProfile === "diff_review") {
    throw new AssistantError(
      "PR review plans retain their captured revision. Create a new review to change the target.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (changesPlan && task.status !== "backlog") {
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

  if (
    (input.assumptions !== undefined || input.killConditions !== undefined) &&
    isTerminalProjectTaskStatus(task.status)
  ) {
    throw new AssistantError(
      "A finished task keeps the assumptions it was judged against.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (input.status !== undefined) {
    assertProjectTaskTransition({ actor, from: task.status, to: input.status });
  }

  await assertAssigneeIsMember(context, project.workspace_id, input.assigneeUserId);
  assertStageExists(flow, input.stageId);
  await assertDependenciesExist(context, projectId, taskId, input.dependsOnTaskIds);
  await assertParentAllowed(context, projectId, taskId, input.parentTaskId);

  await assertTaskSourcesAvailable(context, projectId, input.context?.sourceIds);

  const nextStatus = input.status ?? task.status;
  const isFinishing = isTerminalProjectTaskStatus(nextStatus) && nextStatus !== task.status;
  const updated = await context.repositories.get(ProjectTaskRepository).updateTask(taskId, {
    ...input,
    ...ownership,
    acceptanceCriteria: withCriterionIds(input.acceptanceCriteria),
    assumptions: input.assumptions ? withGeneratedIds(input.assumptions) : undefined,
    killConditions: input.killConditions ? withGeneratedIds(input.killConditions) : undefined,
    ...(input.status !== undefined && input.status !== "blocked"
      ? { blockedReason: null, blockedDetail: null }
      : {}),
    ...(isFinishing ? { completedAt: new Date().toISOString() } : {}),
  });

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  if (input.status !== undefined && input.status !== task.status) {
    await context.repositories.get(AuditRepository).createRecord({
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

  if (isFinishing && (nextStatus === "done" || nextStatus === "cancelled")) {
    await recordRetrospectiveQuietly(context, updated, nextStatus);
  }

  await reconcileTaskNotifications(context, updated);

  if (input.status === "done" && task.status !== "done") {
    await releaseReadyDependentTasks(context, projectId, taskId);
  }

  return { task: updated };
}

export async function startProjectTask(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  options: {
    approvalResolved?: boolean;
    automaticReviewPolicyRevision?: string;
    approvedTools?: string[];
    interaction?: { toolName: string; response: Record<string, unknown> };
  } = {},
) {
  const user = context.requireUser();
  const { project } = await requireProjectAccess(context, projectId);
  const task = await requireTask(context, projectId, taskId);
  const flow = task.flowSnapshot ?? parseProjectFlow(project.flow);

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

  if (task.status === "blocked" && task.blockedReason === "run_failed") {
    const unsafeRunIds = await context.repositories
      .get(ConnectorOperationApprovalRepository)
      .listConsumedRunIds(task.runId ? [task.runId] : []);
    const resume = getProjectTaskResumeCapability(task, unsafeRunIds);

    if (!resume.supported) {
      throw new AssistantError(
        resume.reason ?? "This stage cannot be retried safely",
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
    const blocked = await context.repositories.get(ProjectTaskRepository).updateTask(taskId, {
      status: "blocked",
      blockedReason: "dependencies_unmet",
      blockedDetail:
        `Starts when these finish: ${unmet.map((dependency) => dependency.objective).join("; ")}`.slice(
          0,
          500,
        ),
      runnerIdentityUserId: user.id,
    });

    if (blocked) {
      await reconcileTaskNotifications(context, blocked);
    }

    throw new AssistantError(
      `This task will start when its dependencies are done: ${unmet
        .map((dependency) => dependency.objective)
        .join("; ")}`,
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const active = await context.repositories.get(ProjectTaskRepository).countActiveTasks(projectId);

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
    automaticReviewPolicyRevision: options.automaticReviewPolicyRevision,
    runnerIdentityUserId: user.id,
    stageId: task.stageId ?? flow?.stages[0]?.id ?? null,
    approvedTools: options.approvedTools,
    interaction: options.interaction,
  });

  await context.repositories.get(AuditRepository).createRecord({
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

  const flow = task.flowSnapshot ?? parseProjectFlow(project.flow);
  const nextStage = nextFlowStageId(flow, task.stageId);
  let updated: ProjectTask | null;

  if (nextStage) {
    const completions = approveLatestProjectTaskCompletion(task.completions, user.id);
    const reviewed = await context.repositories
      .get(ProjectTaskRepository)
      .updateTask(taskId, { completions });

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
    updated = await context.repositories.get(ProjectTaskRepository).updateTask(taskId, {
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

  await context.repositories.get(AuditRepository).createRecord({
    workspaceId: project.workspace_id,
    actorUserId: user.id,
    action: nextStage ? "project.task.stage_started" : "project.task.accepted",
    targetType: "project_task",
    targetId: taskId,
    metadata: { projectId, stageId: nextStage ?? task.stageId },
  });

  await reconcileTaskNotifications(context, updated);

  if (!nextStage) {
    await recordRetrospectiveQuietly(context, updated, "done");
    await releaseReadyDependentTasks(context, projectId, taskId);
  }

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

  if (task.runId || task.completions.length > 0) {
    throw new AssistantError(
      "Cancel this task to retain its execution evidence. Only an unstarted plan can be deleted.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  await context.repositories.get(ProjectTaskRepository).deleteTask(taskId);
  await context.repositories.get(AuditRepository).createRecord({
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
    const [capabilities, defaultTeammateIds] = await Promise.all([
      context.repositories.get(WorkspaceRepository).listProjectCapabilities(projectId),
      listProjectDefaultTeammateIds(context, project.workspace_id),
    ]);
    const availableTeammates = new Set(
      resolveProjectTeammateIds({ capabilities, defaultTeammateIds }),
    );
    const missing = flow.stages
      .map((stage) => stage.teammateId)
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

  await context.repositories.get(WorkspaceRepository).updateProject(projectId, {
    flow: flow ? JSON.stringify(flow) : null,
  });
  await context.repositories.get(AuditRepository).createRecord({
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
