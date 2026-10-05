import {
  findProjectFlowNode,
  validateNativeRecordValues,
  type ProjectFlowWait,
  type ProjectTask,
  type ResolveProjectFlowWaitInput,
  type NativeRecordValues,
} from "@ngriffin_uk/polychat-schemas";
import { canonicalJson, generateId } from "@ngriffin_uk/polychat-utility-core";
import { sha256Hex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import z from "zod/v4";

import { createServiceContext, type ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireNativeRecordTable } from "~/modules/records/application/access";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { completeProjectFlowWait, stepProjectFlow } from "../domain/flow-machine";
import type { FlowExecutionOwner } from "../infrastructure/ProjectFlowRepository";
import { reconcileTaskNotifications } from "./attention";
import { canReviewProjectFlowWait } from "./flow-authority";
import { queueProjectTaskRun } from "./runner";

export async function reloadFlowTask(
  context: ServiceContext,
  taskId: string,
): Promise<ProjectTask> {
  const task = await context.repositories.projectTasks.getTaskById(taskId);

  if (!task) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  return task;
}

async function continueAsOriginalRunner(context: ServiceContext, taskId: string) {
  const task = await reloadFlowTask(context, taskId);
  const runner = await context.repositories.users.getUserById(
    task.runnerIdentityUserId ?? task.createdByUserId,
  );

  if (!runner) {
    throw new AssistantError(
      "The original runner is no longer available",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const runnerContext = createServiceContext({
    env: context.env,
    user: runner,
    waitUntil: context.waitUntil,
    executionCtx: context.executionCtx,
  });

  return { task: await driveProjectFlow(runnerContext, task) };
}

export async function driveProjectFlow(
  context: ServiceContext,
  initial: ProjectTask,
): Promise<ProjectTask> {
  let task = initial;
  const actorUserId = context.requireUser().id;

  await requireProjectAccess(context, task.projectId);
  if (task.runnerIdentityUserId !== null && task.runnerIdentityUserId !== actorUserId) {
    return (await continueAsOriginalRunner(context, task.id)).task;
  }

  for (let count = 0; count < task.flowSnapshot.maxSteps; count += 1) {
    if (task.status === "done" || task.status === "cancelled") {
      return task;
    }

    if (task.flowExecution.waitId) {
      return task;
    }

    let step: ReturnType<typeof stepProjectFlow>;

    try {
      step = stepProjectFlow(task.flowSnapshot, task.flowExecution);
    } catch (error) {
      if (!(error instanceof AssistantError)) {
        throw error;
      }

      const committed = await context.repositories.projectFlows.transition({
        task,
        execution: task.flowExecution,
        actorUserId,
        status: "blocked",
        blockedReason: "stalled",
        kind: "failed",
        detail: error.message,
      });

      if (!committed) {
        throw new AssistantError(
          "The flow changed before it could stop",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      const stopped = await reloadFlowTask(context, task.id);

      await reconcileTaskNotifications(context, stopped);

      return stopped;
    }

    let wait: ProjectFlowWait | undefined;

    if (step.kind === "wait") {
      const node = step.node;
      const now = new Date().toISOString();
      const payload: Record<string, unknown> = {};

      if (node.type === "function" && node.operation.kind === "create_record") {
        const access = await requireNativeRecordTable(context, node.operation.tableId);

        if (
          access.table.output.projectId !== task.projectId ||
          access.table.definition.visibility !== "shared"
        ) {
          throw new AssistantError(
            "Flow records must be shared in this project",
            ErrorType.FORBIDDEN,
            403,
          );
        }

        payload.tableRevision = access.table.output.revision;
        payload.requestId = crypto.randomUUID();
      }

      const assignedUserId =
        node.type === "human_wait"
          ? (node.assigneeUserId ?? task.assigneeUserId ?? task.createdByUserId)
          : null;

      if (node.type === "human_wait") {
        payload.assignedUserId = assignedUserId;
      }

      if (
        assignedUserId &&
        !(await context.repositories.workspaces.getMembership(task.workspaceId, assignedUserId))
      ) {
        throw new AssistantError(
          "The flow reviewer is no longer a workspace member",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      wait = {
        id: generateId(),
        taskId: task.id,
        nodeId: node.id,
        epoch: step.execution.epoch,
        step: step.execution.steps,
        attempt: 1,
        name: node.name,
        kind: node.type === "human_wait" ? "human" : node.type,
        status: "pending",
        revision: 1,
        assignedUserId,
        dueAt:
          node.type === "timer" ? new Date(Date.now() + node.seconds * 1000).toISOString() : null,
        executionId: null,
        payload,
        response: null,
        error: null,
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
      };
      step.execution.waitId = wait.id;
    }

    const status =
      step.kind === "finished"
        ? step.node.status
        : wait?.kind === "human"
          ? "review"
          : wait?.kind === "timer"
            ? "blocked"
            : "backlog";
    const committed = await context.repositories.projectFlows.transition({
      task,
      execution: step.execution,
      actorUserId,
      status,
      wait,
      completions:
        wait?.kind === "human"
          ? task.completions.map((completion, index) =>
              index === task.completions.length - 1 && !completion.approval.reviewWaitId
                ? {
                    ...completion,
                    approval: {
                      ...completion.approval,
                      mode: "human",
                      status: "pending",
                      reviewedAt: null,
                      reviewedByUserId: null,
                      reviewWaitId: wait.id,
                    },
                  }
                : completion,
            )
          : undefined,
      kind:
        step.kind === "finished"
          ? step.node.status === "done"
            ? "completed"
            : "cancelled"
          : step.kind === "advance"
            ? step.from.type === "loop"
              ? "iteration"
              : "branch"
            : "waiting",
      detail:
        wait?.kind === "human" && step.kind === "wait" && step.node.type === "human_wait"
          ? step.node.prompt
          : step.kind === "advance"
            ? `Continue to ${findProjectFlowNode(task.flowSnapshot, step.execution.nodeId)?.name ?? step.execution.nodeId}`
            : undefined,
    });

    if (!committed) {
      throw new AssistantError(
        "The flow changed before it could advance",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    task = await reloadFlowTask(context, task.id);
    await reconcileTaskNotifications(context, task);
    if (wait?.kind === "agent" || wait?.kind === "function") {
      return queueProjectTaskRun({
        context,
        task,
        runnerIdentityUserId: task.runnerIdentityUserId ?? actorUserId,
      });
    }

    if (wait || step.kind === "finished") {
      return task;
    }
  }

  throw new AssistantError("The flow reached its step limit", ErrorType.CONFLICT_ERROR, 409);
}

export async function resolveHumanFlowWait(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  waitId: string,
  input: ResolveProjectFlowWaitInput,
) {
  const user = context.requireUser();
  const { role } = await requireProjectAccess(context, projectId);
  const task = await reloadFlowTask(context, taskId);
  const wait = await context.repositories.projectFlows.getWait(waitId);

  if (task.projectId !== projectId || !wait || wait.taskId !== taskId || wait.kind !== "human") {
    throw new AssistantError("Review wait not found", ErrorType.NOT_FOUND, 404);
  }

  if (!canReviewProjectFlowWait(user.id, role, wait)) {
    throw new AssistantError(
      "This review is assigned to another workspace member",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const digest = await sha256Hex(canonicalJson({ actorUserId: user.id, input }));

  if (await context.repositories.projectFlows.responseMatches(waitId, digest)) {
    return continueAsOriginalRunner(context, taskId);
  }

  const node = findProjectFlowNode(task.flowSnapshot, wait.nodeId);

  if (
    !node ||
    node.type !== "human_wait" ||
    wait.revision !== input.expectedRevision ||
    task.flowExecution.waitId !== waitId
  ) {
    throw new AssistantError("This review has already changed", ErrorType.CONFLICT_ERROR, 409);
  }

  let values: NativeRecordValues = {};

  try {
    if (input.resolution === "accepted" && node.fields.length) {
      values = validateNativeRecordValues(
        { format: "records", columns: node.fields, visibility: "shared", editing: "shared" },
        input.values,
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AssistantError(
        error.issues[0]?.message ?? "Invalid review fields",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    throw error;
  }

  if (
    (!node.fields.length || input.resolution === "rejected") &&
    Object.keys(input.values).length
  ) {
    throw new AssistantError(
      "This review does not accept form values",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const execution = completeProjectFlowWait(
    task.flowExecution,
    input.resolution === "accepted" ? node.onAccepted : node.onRejected,
    values,
  );
  const completions = task.completions.map((completion) =>
    completion.approval.reviewWaitId === waitId
      ? {
          ...completion,
          approval: {
            ...completion.approval,
            status: input.resolution === "accepted" ? ("approved" as const) : ("rejected" as const),
            reviewedByUserId: user.id,
            reviewedAt: new Date().toISOString(),
          },
        }
      : completion,
  );
  const committed = await context.repositories.projectFlows.transition({
    task,
    execution,
    actorUserId: user.id,
    status: "backlog",
    kind: "resumed",
    resolve: { wait, values, digest },
    completions,
  });

  if (!committed && !(await context.repositories.projectFlows.responseMatches(waitId, digest))) {
    throw new AssistantError(
      "This review changed before the response was saved",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return continueAsOriginalRunner(context, taskId);
}

export async function completeDispatchedFlowWait(params: {
  context: ServiceContext;
  task: ProjectTask;
  values: ProjectFlowWait["response"];
  owner: FlowExecutionOwner;
  completions?: ProjectTask["completions"];
  tokensSpent?: number;
}) {
  const { context, task, owner } = params;
  const wait = task.flowExecution.waitId
    ? await context.repositories.projectFlows.getWait(task.flowExecution.waitId)
    : null;
  const node = findProjectFlowNode(task.flowSnapshot, task.flowExecution.nodeId);

  if (
    !wait ||
    wait.executionId !== owner.dispatchTaskId ||
    !node ||
    (node.type !== "agent" && node.type !== "function")
  ) {
    throw new AssistantError("The dispatched flow wait changed", ErrorType.CONFLICT_ERROR, 409);
  }

  const values = params.values ?? {};
  const execution = completeProjectFlowWait(task.flowExecution, node.next, values);
  const committed = await context.repositories.projectFlows.transition({
    task,
    execution,
    actorUserId: context.requireUser().id,
    owner,
    status: "backlog",
    kind: "resumed",
    resolve: { wait, values, digest: await sha256Hex(canonicalJson(values)) },
    completions: params.completions,
    tokensSpent: params.tokensSpent,
  });

  if (!committed) {
    throw new AssistantError(
      "The flow worker no longer owns this step",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return reloadFlowTask(context, task.id);
}

export async function recordProjectTaskResumeFailure(
  context: ServiceContext,
  task: ProjectTask,
  detail: string,
): Promise<ProjectTask | null> {
  const saved = await context.repositories.projectFlows.transition({
    task,
    execution: task.flowExecution,
    actorUserId: context.requireUser().id,
    status: "blocked",
    blockedReason: "dispatch_failed",
    kind: "failed",
    detail,
  });

  return saved ? context.repositories.projectTasks.getTaskById(task.id) : null;
}
