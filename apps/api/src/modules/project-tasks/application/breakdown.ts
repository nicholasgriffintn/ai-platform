import {
  isTerminalProjectTaskStatus,
  PROJECT_TASK_MAX_DEPTH,
  type ProjectTask,
  type TaskBreakdown,
  type TaskBreakdownItem,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { sameWorkActor, taskReference } from "~/modules/project-tasks/domain/work-actors";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { managesTeammate, resolveManager } from "~/modules/teammates/application/organisation";
import { enqueueTeammateWake } from "~/modules/teammates/application/wakes";

import { createProjectTask } from "./index";
import { postEvent, requireTaskInProject, wakeTeammateOnTask, type WorkCaller } from "./work";

function conflict(message: string): AssistantError {
  return new AssistantError(message, ErrorType.CONFLICT_ERROR, 409);
}

function orderItems(items: readonly TaskBreakdownItem[]): TaskBreakdownItem[] {
  const keys = new Set(items.map((item) => item.key));

  if (keys.size !== items.length) {
    throw new AssistantError("Give each sub-task its own key", ErrorType.PARAMS_ERROR, 400);
  }

  for (const item of items) {
    const unknown = item.dependsOn.filter((key) => !keys.has(key) || key === item.key);

    if (unknown.length > 0) {
      throw new AssistantError(
        `${item.key} waits on keys that are not other sub-tasks here: ${unknown.join(", ")}`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  const ordered: TaskBreakdownItem[] = [];
  const placed = new Set<string>();

  while (ordered.length < items.length) {
    const ready = items.filter(
      (item) => !placed.has(item.key) && item.dependsOn.every((key) => placed.has(key)),
    );

    if (ready.length === 0) {
      throw new AssistantError(
        "These sub-tasks wait on each other in a loop. Break the cycle.",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    for (const item of ready) {
      ordered.push(item);
      placed.add(item.key);
    }
  }

  return ordered;
}

async function depthOf(context: ServiceContext, task: ProjectTask): Promise<number> {
  const repository = context.repositories.get(ProjectTaskRepository);
  let depth = 1;
  let parentId = task.parentTaskId;

  while (parentId && depth <= PROJECT_TASK_MAX_DEPTH) {
    depth += 1;
    parentId = (await repository.getTaskById(parentId))?.parentTaskId ?? null;
  }

  return depth;
}

async function assertSplittable(context: ServiceContext, task: ProjectTask): Promise<void> {
  if (task.kind !== "task" || isTerminalProjectTaskStatus(task.status)) {
    throw conflict("Only an open task can be split into sub-tasks");
  }

  if (task.details.breakdown?.acceptedAt) {
    throw conflict(
      "This task has already been split. Add further sub-tasks with create_task and parentTaskId.",
    );
  }

  if ((await depthOf(context, task)) >= PROJECT_TASK_MAX_DEPTH) {
    throw conflict(
      `Sub-tasks can go ${PROJECT_TASK_MAX_DEPTH} levels deep, and this task is already at the bottom.`,
    );
  }
}

async function requestBreakdownApproval(
  context: ServiceContext,
  task: ProjectTask,
  breakdown: TaskBreakdown,
): Promise<void> {
  if (task.owner?.type !== "teammate") {
    return;
  }

  const manager = await resolveManager(context, task.workspaceId, task.owner.id);

  if (manager.type === "teammate" && manager.id !== task.owner.id) {
    await enqueueTeammateWake(context, {
      workspaceId: task.workspaceId,
      teammateId: manager.id,
      projectId: task.projectId,
      reason: "review",
      taskId: task.id,
      detail: `Revision ${breakdown.revision} of the breakdown of ${taskReference(task)} is waiting for you. Read it with get_task, then accept_breakdown if the sub-tasks, owners and order are right, or comment with what to change.`,
    });
  }
}

export async function proposeTaskBreakdown(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  items: TaskBreakdownItem[],
  caller: WorkCaller,
): Promise<ProjectTask> {
  const task = await requireTaskInProject(context, projectId, taskId);

  await assertSplittable(context, task);

  if (
    caller.actor.type === "teammate" &&
    !(task.owner && sameWorkActor(task.owner, caller.actor))
  ) {
    throw new AssistantError(
      "Only the task's owner can propose how to split it",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  orderItems(items);

  const breakdown: TaskBreakdown = {
    revision: (task.details.breakdown?.revision ?? 0) + 1,
    items,
    proposedBy: caller.actor,
    proposedAt: new Date().toISOString(),
    acceptedBy: null,
    acceptedAt: null,
    taskIds: {},
  };
  const updated = await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
    details: { ...task.details, breakdown },
  });

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  await postEvent(
    context,
    updated,
    caller,
    `Proposed splitting this into ${items.length} sub-tasks (revision ${breakdown.revision}).`,
  );
  await requestBreakdownApproval(context, updated, breakdown);

  return updated;
}

export async function acceptTaskBreakdown(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  revision: number,
  caller: WorkCaller,
): Promise<ProjectTask> {
  const task = await requireTaskInProject(context, projectId, taskId);
  const breakdown = task.details.breakdown;

  await assertSplittable(context, task);

  if (!breakdown || breakdown.revision !== revision) {
    throw conflict("That revision of the breakdown is no longer current. Read the latest first.");
  }

  if (caller.actor.type === "teammate") {
    const ownerId = task.owner?.type === "teammate" ? task.owner.id : null;

    if (
      !ownerId ||
      ownerId === caller.actor.id ||
      !(await managesTeammate(context, task.workspaceId, caller.actor.id, ownerId))
    ) {
      throw new AssistantError(
        "Only the owner's manager or a person can accept a breakdown",
        ErrorType.FORBIDDEN,
        403,
      );
    }
  }

  const taskIds: Record<string, string> = {};
  const children: ProjectTask[] = [];

  try {
    for (const item of orderItems(breakdown.items)) {
      const { task: child } = await createProjectTask(context, projectId, {
        objective: item.objective,
        priority: item.priority,
        parentTaskId: task.id,
        dependsOnTaskIds: item.dependsOn.map((key) => taskIds[key]).filter(Boolean),
        ...(item.owner ? { owner: item.owner } : {}),
      });

      taskIds[item.key] = child.id;
      children.push(child);
    }
  } catch (error) {
    for (const child of children) {
      await context.repositories.get(ProjectTaskRepository).deleteTask(child.id);
    }

    throw error;
  }

  const updated = await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
    details: {
      ...task.details,
      breakdown: {
        ...breakdown,
        acceptedBy: caller.actor,
        acceptedAt: new Date().toISOString(),
        taskIds,
      },
    },
  });

  if (!updated) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  await postEvent(
    context,
    updated,
    caller,
    `Accepted revision ${revision} and split it into ${children.map(taskReference).join(", ")}.`,
  );

  for (const child of children) {
    if (child.owner?.type === "teammate") {
      await wakeTeammateOnTask(context, child, child.owner.id, "assigned", null);
    }
  }

  return updated;
}
