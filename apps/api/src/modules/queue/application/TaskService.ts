import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { generateId, isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { Task } from "~/infrastructure/database/schema";
import { normaliseIsoDateTime } from "~/infrastructure/date";
import type { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import {
  readTaskWorkflow,
  terminateTaskWorkflow,
} from "~/modules/queue/infrastructure/workflow-instances";
import type { IEnv } from "~/types";

import type { TaskDefinition, TaskMessage } from "./types";

const logger = getLogger({ prefix: "services/tasks" });

export class TaskService {
  private env: Pick<IEnv, "TASK_WORKFLOW">;
  private taskRepository: TaskRepository;

  constructor(env: Pick<IEnv, "TASK_WORKFLOW">, taskRepository: TaskRepository) {
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

      if (!taskResult.created && task.status !== "pending") {
        logger.info("Task already exists, skipping duplicate enqueue", {
          taskId: task.id,
          taskType: taskDef.task_type,
        });

        return task.id;
      }

      if (
        !taskResult.created &&
        (task.task_type !== taskDef.task_type ||
          task.user_id !== (taskDef.user_id ?? null) ||
          task.project_id !== (taskDef.project_id ?? null))
      ) {
        throw new Error(`Task ${task.id} conflicts with an existing task definition`);
      }

      const message: TaskMessage = {
        taskId: task.id,
        task_type: taskDef.task_type,
        user_id: taskDef.user_id,
        project_id: taskDef.project_id,
        task_data: taskDef.task_data,
        priority: taskDef.priority ?? 5,
        schedule_type: taskDef.schedule_type ?? "immediate",
        scheduled_at: scheduledAt,
        max_attempts: task.max_attempts ?? 3,
      };

      await this.startRun(message, task);

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

  public async dispatchPendingTasks(updatedBefore: Date, limit = 100): Promise<number> {
    const tasks = await this.taskRepository.getPendingTasks(limit, updatedBefore);

    for (const task of tasks) {
      await this.dispatchTask(task);
    }

    return tasks.length;
  }

  public async dispatchTask(task: Task): Promise<void> {
    await this.startRun(
      {
        taskId: task.id,
        task_type: task.task_type,
        user_id: task.user_id ?? undefined,
        project_id: task.project_id ?? undefined,
        task_data: isRecord(task.task_data) ? task.task_data : {},
        priority: task.priority ?? 5,
        schedule_type: task.schedule_type,
        scheduled_at: task.scheduled_at ?? undefined,
        max_attempts: task.max_attempts ?? 3,
      },
      task,
    );
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

  public async retryTask(taskId: string): Promise<boolean> {
    const task = await this.taskRepository.resetTaskForRetry(taskId);

    if (!task) {
      return false;
    }

    await this.dispatchTask(task);

    return true;
  }

  public async cancelTask(taskId: string): Promise<boolean> {
    const task = await this.taskRepository.cancelOpenTask(taskId);

    if (!task) {
      return false;
    }

    if (task.workflow_instance_id && this.env.TASK_WORKFLOW) {
      await terminateTaskWorkflow(this.env.TASK_WORKFLOW, task.workflow_instance_id);
    }

    return true;
  }

  private async startRun(
    message: TaskMessage,
    seen: Pick<Task, "status" | "workflow_instance_id">,
  ): Promise<void> {
    if (!this.env.TASK_WORKFLOW) {
      throw new Error("TASK_WORKFLOW binding is not available; task remains pending for recovery");
    }

    const instanceId = generateId();

    const claimed = await this.taskRepository.claimTaskForDispatch({
      taskId: message.taskId,
      instanceId,
      expectedStatus: seen.status,
      expectedInstanceId: seen.workflow_instance_id ?? null,
    });

    if (!claimed) {
      return;
    }

    try {
      await this.env.TASK_WORKFLOW.create({ id: instanceId, params: message });
    } catch (error) {
      const workflow = await readTaskWorkflow(this.env.TASK_WORKFLOW, instanceId);

      if (workflow.status !== "unavailable") {
        return;
      }

      await this.taskRepository.releaseDispatchClaim(message.taskId, instanceId);

      throw error;
    }
  }
}
