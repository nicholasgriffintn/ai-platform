import type { TaskType, ScheduleType } from "@ngriffin_uk/polychat-schemas";

import type { Task } from "~/lib/database/schema";
import type { TaskRepository } from "~/repositories/TaskRepository";
import type { IEnv } from "~/types";
import { normaliseIsoDateTime } from "~/utils/date";
import { getLogger } from "~/utils/logger";
import { isRecord } from "~/utils/objects";

const logger = getLogger({ prefix: "services/tasks" });

export interface TaskDefinition {
  id?: string;
  task_type: TaskType;
  user_id?: number;
  project_id?: string;
  task_data: Record<string, any>;
  schedule_type?: ScheduleType;
  scheduled_at?: string;
  cron_expression?: string;
  priority?: number;
  metadata?: Record<string, any>;
}

export interface TaskMessage {
  taskId: string;
  task_type: TaskType;
  user_id?: number;
  project_id?: string;
  task_data: Record<string, any>;
  priority: number;
  schedule_type?: ScheduleType;
  scheduled_at?: string;
  max_attempts?: number;
}

export const MAX_QUEUE_DELAY_SECONDS = 60 * 60 * 12;

export class TaskService {
  private env: IEnv;
  private taskRepository: TaskRepository;

  constructor(env: IEnv, taskRepository: TaskRepository) {
    this.env = env;
    this.taskRepository = taskRepository;
  }

  public async enqueueTask(taskDef: TaskDefinition): Promise<string> {
    try {
      const createdBy: "system" | "user" = taskDef.user_id ? "user" : "system";
      const scheduledAt = taskDef.scheduled_at
        ? normaliseIsoDateTime(taskDef.scheduled_at)
        : undefined;
      const taskParams = {
        id: taskDef.id,
        task_type: taskDef.task_type,
        user_id: taskDef.user_id,
        project_id: taskDef.project_id,
        task_data: taskDef.task_data,
        schedule_type: taskDef.schedule_type ?? "immediate",
        scheduled_at: scheduledAt,
        cron_expression: taskDef.cron_expression,
        priority: taskDef.priority ?? 5,
        metadata: taskDef.metadata,
        created_by: createdBy,
      };

      const taskResult = taskDef.id
        ? await this.taskRepository.createTaskIfAbsent({
            ...taskParams,
            id: taskDef.id,
          })
        : { task: await this.taskRepository.createTask(taskParams), created: true };
      const task = taskResult.task;

      if (!task) {
        throw new Error("Failed to create task record");
      }

      if (!taskResult.created) {
        if (task.status !== "pending" && task.status !== "queued") {
          logger.info("Task already left the enqueueable state, skipping duplicate enqueue", {
            taskId: task.id,
            taskType: taskDef.task_type,
            status: task.status,
          });

          return task.id;
        }

        if (
          task.task_type !== taskDef.task_type ||
          task.user_id !== (taskDef.user_id ?? null) ||
          task.project_id !== (taskDef.project_id ?? null)
        ) {
          throw new Error(`Task ${task.id} conflicts with an existing task definition`);
        }

        logger.info("Re-sending an existing queued task after an idempotent retry", {
          taskId: task.id,
          taskType: taskDef.task_type,
        });
      }

      if (task.status !== "queued") {
        await this.taskRepository.updateTask(task.id, { status: "queued" });
      }

      const storedTaskData = isRecord(task.task_data) ? task.task_data : taskDef.task_data;

      const message: TaskMessage = {
        taskId: task.id,
        task_type: task.task_type ?? taskDef.task_type,
        user_id: task.user_id ?? taskDef.user_id,
        project_id: task.project_id ?? taskDef.project_id,
        task_data: storedTaskData,
        priority: task.priority ?? taskDef.priority ?? 5,
        schedule_type: task.schedule_type ?? taskDef.schedule_type ?? "immediate",
        scheduled_at: task.scheduled_at ?? scheduledAt,
        max_attempts: task.max_attempts ?? 3,
      };

      if (!this.env.TASK_QUEUE) {
        throw new Error("TASK_QUEUE binding is not available; task remains queued for recovery");
      }

      await this.sendMessage(message);

      logger.info("Task enqueued successfully", {
        taskId: task.id,
        taskType: taskDef.task_type,
        priority: message.priority,
        queuedAt: message.task_data?.queuedAt ?? Date.now(),
      });

      return task.id;
    } catch (error) {
      logger.error("Failed to enqueue task:", error);
      throw error;
    }
  }

  public async dispatchPendingTasks(limit = 100): Promise<number> {
    if (!this.env.TASK_QUEUE) {
      throw new Error("TASK_QUEUE binding is not available; pending tasks cannot be recovered");
    }

    const tasks = await this.taskRepository.getPendingTasks(limit);
    let dispatched = 0;

    for (const task of tasks) {
      const message: TaskMessage = {
        taskId: task.id,
        task_type: task.task_type,
        user_id: task.user_id ?? undefined,
        project_id: task.project_id ?? undefined,
        task_data: isRecord(task.task_data) ? task.task_data : {},
        priority: task.priority ?? 5,
        schedule_type: task.schedule_type,
        scheduled_at: task.scheduled_at ?? undefined,
        max_attempts: task.max_attempts ?? 3,
      };

      // A duplicate delivery is safe because the consumer atomically claims the durable task.
      // eslint-disable-next-line no-await-in-loop
      await this.sendMessage(message);
      // eslint-disable-next-line no-await-in-loop
      await this.taskRepository.updateTask(task.id, { status: "queued" });
      dispatched++;
    }

    return dispatched;
  }

  public async scheduleRecurringTask(
    taskDef: TaskDefinition,
    cronExpression: string,
  ): Promise<string> {
    const task = await this.taskRepository.createTask({
      task_type: taskDef.task_type,
      user_id: taskDef.user_id,
      project_id: taskDef.project_id,
      task_data: taskDef.task_data,
      schedule_type: "recurring",
      cron_expression: cronExpression,
      priority: taskDef.priority ?? 5,
      metadata: taskDef.metadata,
      created_by: taskDef.user_id ? "user" : "system",
    });

    if (!task) {
      throw new Error("Failed to create recurring task");
    }

    logger.info(`Recurring task ${task.id} scheduled with cron: ${cronExpression}`);

    return task.id;
  }

  public async getTask(taskId: string): Promise<Task | null> {
    return this.taskRepository.getTaskById(taskId);
  }

  public async getUserTasks(userId: number, limit = 50): Promise<Task[]> {
    return this.taskRepository.getTasksByUserId(userId, limit);
  }

  public async cancelTask(taskId: string): Promise<boolean> {
    const task = await this.taskRepository.getTaskById(taskId);

    if (!task) {
      return false;
    }

    if (task.status === "completed" || task.status === "cancelled") {
      return false;
    }

    await this.taskRepository.updateTask(taskId, { status: "cancelled" });

    return true;
  }

  private async sendMessage(message: TaskMessage): Promise<void> {
    if (!this.env.TASK_QUEUE) {
      throw new Error("TASK_QUEUE binding is not available");
    }

    let delaySeconds: number | undefined;

    if (message.schedule_type === "scheduled" && message.scheduled_at) {
      const scheduledAtMs = Date.parse(message.scheduled_at);

      if (Number.isFinite(scheduledAtMs)) {
        const delayMs = scheduledAtMs - Date.now();

        if (delayMs > 0) {
          delaySeconds = Math.min(MAX_QUEUE_DELAY_SECONDS, Math.ceil(delayMs / 1000));
        }
      }
    }

    if (delaySeconds) {
      await this.env.TASK_QUEUE.send(message, { delaySeconds });
    } else {
      await this.env.TASK_QUEUE.send(message);
    }
  }
}
