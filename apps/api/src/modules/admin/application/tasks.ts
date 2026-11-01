import type {
  AdminTaskDetail,
  AdminTasksResponse,
  AdminTaskView,
  TaskStatus,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { readTaskWorkflow } from "~/modules/queue/infrastructure/workflow-instances";

const ADMIN_TASK_LIMIT = 100;
const SUMMARY_WINDOW_MS = 24 * 60 * 60 * 1000;
const VIEW_STATUSES: Record<AdminTaskView, readonly TaskStatus[]> = {
  active: ["pending", "queued", "running", "suspended"],
  failed: ["failed"],
  all: ["pending", "queued", "running", "suspended", "completed", "failed", "cancelled"],
};

async function requireTask(context: ServiceContext, taskId: string) {
  const task = await context.repositories.get(TaskRepository).getTaskById(taskId);

  if (!task) {
    throw new AssistantError("Task not found", ErrorType.NOT_FOUND, 404);
  }

  return task;
}

export async function listAdminTasks(
  context: ServiceContext,
  query: { view: AdminTaskView; task_type?: string },
): Promise<AdminTasksResponse> {
  const tasks = context.repositories.get(TaskRepository);
  const since = new Date(Date.now() - SUMMARY_WINDOW_MS);
  const [types, recent] = await Promise.all([
    tasks.summariseTaskTypes(since),
    tasks.listRecentTasks({
      statuses: VIEW_STATUSES[query.view],
      taskType: query.task_type,
      limit: ADMIN_TASK_LIMIT,
    }),
  ]);

  return { since: since.toISOString(), types, tasks: recent };
}

export async function readAdminTask(
  context: ServiceContext,
  taskId: string,
): Promise<AdminTaskDetail> {
  const task = await requireTask(context, taskId);
  const [executions, workflow] = await Promise.all([
    context.repositories.get(TaskRepository).getTaskExecutions(taskId),
    task.workflow_instance_id && context.env.TASK_WORKFLOW
      ? readTaskWorkflow(context.env.TASK_WORKFLOW, task.workflow_instance_id)
      : null,
  ]);

  return {
    task: {
      id: task.id,
      task_type: task.task_type,
      status: task.status,
      user_id: task.user_id,
      project_id: task.project_id,
      priority: task.priority ?? 5,
      attempts: task.attempts ?? 0,
      max_attempts: task.max_attempts ?? 3,
      schedule_type: task.schedule_type,
      scheduled_at: task.scheduled_at,
      last_attempted_at: task.last_attempted_at,
      completed_at: task.completed_at,
      workflow_instance_id: task.workflow_instance_id,
      error_message: task.error_message,
      task_data: isRecord(task.task_data) ? task.task_data : null,
      metadata: isRecord(task.metadata) ? task.metadata : null,
      created_at: task.created_at,
      updated_at: task.updated_at,
    },
    workflow,
    steps: executions.map((execution) => ({
      id: execution.id,
      step: execution.step,
      status: execution.status,
      started_at: execution.started_at,
      completed_at: execution.completed_at,
      execution_time_ms: execution.execution_time_ms,
      error_message: execution.error_message,
    })),
  };
}

export async function retryAdminTask(
  context: ServiceContext,
  taskId: string,
): Promise<AdminTaskDetail> {
  const tasks = new TaskService(context.env, context.repositories.get(TaskRepository));

  if (!(await tasks.retryTask(taskId))) {
    throw new AssistantError(
      "Only a failed or cancelled task can be retried",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return readAdminTask(context, taskId);
}

export async function cancelAdminTask(
  context: ServiceContext,
  taskId: string,
): Promise<AdminTaskDetail> {
  const tasks = new TaskService(context.env, context.repositories.get(TaskRepository));

  if (!(await tasks.cancelTask(taskId))) {
    throw new AssistantError("This task has already finished", ErrorType.CONFLICT_ERROR, 409);
  }

  return readAdminTask(context, taskId);
}
