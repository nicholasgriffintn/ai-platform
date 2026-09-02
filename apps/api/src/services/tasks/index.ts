import type {
  CreatePublicTaskRequest,
  TriggerMemorySynthesisRequest,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";

import { TaskService } from "./TaskService";
import { isAccountVisibleTask } from "./taskVisibility";

export async function listUserTasks(context: ServiceContext, userId: number) {
  const tasks = (await context.repositories.tasks.getTasksByUserId(userId)).filter(
    isAccountVisibleTask,
  );

  return { tasks, total: tasks.length };
}

export async function getUserTask(context: ServiceContext, userId: number, taskId: string) {
  const task = await context.repositories.tasks.getTaskById(taskId);

  if (!task || task.user_id !== userId) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  const executions = await context.repositories.tasks.getTaskExecutions(taskId);

  return { task, executions };
}

export async function createMemorySynthesisTask(
  context: ServiceContext,
  userId: number,
  input: TriggerMemorySynthesisRequest,
) {
  const taskService = new TaskService(context.env, context.repositories.tasks);
  const taskId = await taskService.enqueueTask({
    task_type: "memory_synthesis",
    user_id: userId,
    task_data: { namespace: input.namespace || "global" },
    priority: 7,
  });

  return {
    task_id: taskId,
    status: "queued",
    message: "Memory synthesis task queued successfully",
  };
}

export async function createUserTask(
  context: ServiceContext,
  userId: number,
  input: CreatePublicTaskRequest,
) {
  const taskService = new TaskService(context.env, context.repositories.tasks);
  const taskId = await taskService.enqueueTask({
    task_type: input.task_type,
    user_id: userId,
    task_data: input.task_data,
    schedule_type: input.schedule_type,
    scheduled_at: input.scheduled_at,
    priority: input.priority,
    metadata: input.metadata,
  });

  return {
    task_id: taskId,
    status: "queued",
    message: "Task created successfully",
  };
}

export async function cancelUserTask(context: ServiceContext, userId: number, taskId: string) {
  const task = await context.repositories.tasks.getTaskById(taskId);

  if (!task || task.user_id !== userId) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  const taskService = new TaskService(context.env, context.repositories.tasks);
  const cancelled = await taskService.cancelTask(taskId);

  if (!cancelled) {
    throw new AssistantError("Task cannot be cancelled", ErrorType.PARAMS_ERROR, 400);
  }

  return { message: "Task cancelled successfully" };
}

export async function getActiveMemorySynthesis(
  context: ServiceContext,
  userId: number,
  namespace = "global",
) {
  const synthesis = await context.repositories.memorySyntheses.getActiveSynthesis(
    userId,
    namespace,
  );

  return { synthesis: synthesis || null };
}

export async function listMemorySyntheses(
  context: ServiceContext,
  userId: number,
  filters: { namespace?: string; limit: number },
) {
  const syntheses = await context.repositories.memorySyntheses.getSynthesesByUserId(
    userId,
    filters.namespace,
    filters.limit,
  );

  return { syntheses, total: syntheses.length };
}
