import type { ApiToolDefinition } from "../../types/functions";
import { get_task_status as get_task_statusDescriptor, MAX_TASK_LIMIT } from "./definitions/tasks";

const DEFAULT_TASK_LIMIT = 3;

function formatTaskStatus(task: {
  id: string;
  task_type: string;
  status?: string | null;
  error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
}) {
  const status = task.status ?? "unknown";
  const error = task.error_message ? ` Error: ${task.error_message}` : "";

  return `${task.task_type} ${task.id}: ${status}.${error}`;
}

export const get_task_status: ApiToolDefinition = {
  ...get_task_statusDescriptor,
  execute: async (args, toolContext) => {
    const request = toolContext.request;
    const userId = request.user?.id;

    if (!request.context || !userId) {
      throw new Error("Signed-in user context is required for task tools");
    }

    const taskId = typeof args.taskId === "string" ? args.taskId.trim() : "";

    if (taskId) {
      const task = await request.context.repositories.tasks.getTaskById(taskId);

      if (!task || task.user_id !== userId) {
        return {
          status: "error",
          name: "get_task_status",
          content: "I could not find that task for your account.",
          data: { taskId },
        };
      }

      return {
        status: "success",
        name: "get_task_status",
        content: formatTaskStatus(task),
        data: { task },
      };
    }

    const requestedLimit = typeof args.limit === "number" ? Math.floor(args.limit) : undefined;
    const limit = Math.min(Math.max(requestedLimit ?? DEFAULT_TASK_LIMIT, 1), MAX_TASK_LIMIT);
    const tasks = await request.context.repositories.tasks.getTasksByUserId(userId, limit);

    if (tasks.length === 0) {
      return {
        status: "success",
        name: "get_task_status",
        content: "You do not have any recent tasks.",
        data: { tasks: [] },
      };
    }

    return {
      status: "success",
      name: "get_task_status",
      content: `Recent tasks:\n${tasks.map(formatTaskStatus).join("\n")}`,
      data: { tasks },
    };
  },
};
