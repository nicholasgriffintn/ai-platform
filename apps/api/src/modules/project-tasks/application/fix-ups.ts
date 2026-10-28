import {
  isTerminalProjectTaskStatus,
  type ProjectTask,
  type ProjectTaskFixUp,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";

import { reconcileTaskNotifications } from "./attention";
import { postEvent, wakeTeammateOnTask, type WorkCaller } from "./work";

export async function sendFixUp(
  context: ServiceContext,
  task: ProjectTask,
  fixUp: Omit<ProjectTaskFixUp, "at">,
  caller: WorkCaller,
): Promise<ProjectTask> {
  if (isTerminalProjectTaskStatus(task.status)) {
    return task;
  }

  const inFlight = task.status === "running" || task.status === "queued";
  const updated = await context.repositories.get(ProjectTaskRepository).updateTask(task.id, {
    details: { ...task.details, fixUp: { ...fixUp, at: new Date().toISOString() } },
    ...(inFlight ? {} : { status: "backlog", blockedReason: null, blockedDetail: null }),
  });

  if (!updated) {
    return task;
  }

  await postEvent(context, updated, caller, `${fixUp.from} asked for a fix: ${fixUp.note}`);
  await reconcileTaskNotifications(context, updated);

  if (!inFlight && updated.owner?.type === "teammate") {
    await wakeTeammateOnTask(context, updated, updated.owner.id, "assigned", fixUp.note);
  }

  return updated;
}

export async function settleFixUp(
  context: ServiceContext,
  taskId: string,
  consumed: ProjectTaskFixUp | undefined,
): Promise<void> {
  if (!consumed) {
    return;
  }

  const repository = context.repositories.get(ProjectTaskRepository);
  const current = await repository.getTaskById(taskId);

  if (current?.details.fixUp?.at !== consumed.at) {
    return;
  }

  await repository.updateTask(taskId, { details: { ...current.details, fixUp: undefined } });
}

export async function wakeTaskReviewer(context: ServiceContext, taskId: string): Promise<void> {
  const task = await context.repositories.get(ProjectTaskRepository).getTaskById(taskId);
  const reviewer = task?.reviewer;

  if (
    !task ||
    task.status !== "review" ||
    reviewer?.type !== "teammate" ||
    (task.owner?.type === "teammate" && task.owner.id === reviewer.id)
  ) {
    return;
  }

  await wakeTeammateOnTask(context, task, reviewer.id, "review", null);
}
