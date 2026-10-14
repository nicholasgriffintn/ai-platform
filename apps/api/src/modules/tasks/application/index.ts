import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { listPageOf } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { presentPublicTask } from "./task-presentation";
import { TaskService } from "./TaskService";
import { isAccountVisibleTask } from "./taskVisibility";

export async function listUserTasks(context: ServiceContext, userId: number) {
  const tasks = (await context.repositories.tasks.getTasksByUserId(userId)).filter(
    isAccountVisibleTask,
  );

  return listPageOf(tasks.map(presentPublicTask), (task) => task.id);
}

export async function getUserTask(context: ServiceContext, userId: number, taskId: string) {
  const task = await context.repositories.tasks.getTaskById(taskId);

  if (!task || !ownsResource(userId, task.user_id)) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  const executions = await context.repositories.tasks.getTaskExecutions(taskId);

  return { task: presentPublicTask(task), executions };
}

export async function cancelUserTask(context: ServiceContext, userId: number, taskId: string) {
  const task = await context.repositories.tasks.getTaskById(taskId);

  if (!task || !ownsResource(userId, task.user_id)) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  const taskService = new TaskService(context.env, context.repositories.tasks);
  const cancelled = await taskService.cancelTask(taskId);

  if (!cancelled) {
    throw new AssistantError("Task cannot be cancelled", ErrorType.PARAMS_ERROR, 400);
  }

  return { message: "Task cancelled successfully" };
}
