import type { TaskType } from "@ngriffin_uk/polychat-schemas";

import { ENABLED_SCHEDULES_FLAGS } from "~/constants/schedules";
import { TaskRepository } from "~/repositories/TaskRepository";
import type { IEnv } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

import {
  createTaskExecutionLease,
  isTaskExecutionOwnershipLostError,
  taskExecutionLeaseExpiry,
  taskExecutionLeaseRetryDelay,
  TaskExecutionLeaseBusyError,
  TaskExecutionOwnershipLostError,
} from "./task-execution-lease";
import type { TaskExecutionContext, TaskHandler, TaskResult } from "./TaskHandler";
import type { TaskMessage } from "./TaskService";

const logger = getLogger({ prefix: "services/tasks/executor" });

function hasFeatureFlag(taskType: TaskType): taskType is keyof typeof ENABLED_SCHEDULES_FLAGS {
  return taskType in ENABLED_SCHEDULES_FLAGS;
}

export class TaskExecutor {
  private env: IEnv;
  private handlers: Map<TaskType, TaskHandler>;
  private taskRepository: TaskRepository;

  constructor(env: IEnv, handlers: Map<TaskType, TaskHandler>) {
    this.env = env;
    this.handlers = handlers;
    this.taskRepository = new TaskRepository(env);
  }

  public async execute(message: TaskMessage, deliveryAttempt = 1): Promise<void> {
    const startTime = Date.now();
    const isRedelivery = deliveryAttempt > 1;

    try {
      if (hasFeatureFlag(message.task_type)) {
        const isEnabledEnvVar = ENABLED_SCHEDULES_FLAGS[message.task_type];

        if (this.env[isEnabledEnvVar] !== "true") {
          const completedAt = new Date().toISOString();

          await this.taskRepository.updateTask(message.taskId, {
            status: "cancelled",
            completed_at: completedAt,
            error_message: `Task type ${message.task_type} is disabled via environment variable ${isEnabledEnvVar}`,
          });
          logger.info(`Task type ${message.task_type} is disabled via environment variable`);

          return;
        }
      }

      const handler = this.handlers.get(message.task_type);

      if (!handler) {
        await this.taskRepository.updateTask(message.taskId, {
          status: "cancelled",
          completed_at: new Date().toISOString(),
          error_message: `Unknown task type: ${message.task_type}`,
        });
        logger.warn(`Unknown task type ${message.task_type} was cancelled`);

        return;
      }

      const ownerToken = generateId();
      const leaseExpiresAt = taskExecutionLeaseExpiry();
      const claimedTask = await this.taskRepository.claimTaskForExecution(message.taskId, {
        ownerToken,
        leaseExpiresAt,
        resumeInterrupted: isRedelivery,
      });

      if (!claimedTask) {
        const currentTask = await this.taskRepository.getTaskById(message.taskId);

        if (
          currentTask?.status === "running" &&
          currentTask.execution_lease_expires_at &&
          Date.parse(currentTask.execution_lease_expires_at) > Date.now()
        ) {
          throw new TaskExecutionLeaseBusyError(
            taskExecutionLeaseRetryDelay(currentTask.execution_lease_expires_at),
          );
        }

        logger.info(`Task ${message.taskId} is not claimable, skipping duplicate delivery`);

        return;
      }

      const lease = createTaskExecutionLease({
        repository: this.taskRepository,
        taskId: message.taskId,
        ownerToken,
        initialExpiresAt: leaseExpiresAt,
      });
      const executionContext: TaskExecutionContext = {
        deliveryAttempt,
        isRedelivery,
        lease,
      };

      if (isRedelivery) {
        await this.taskRepository.failRunningTaskExecutions(
          message.taskId,
          "The previous queue delivery ended before recording an outcome.",
        );
      }

      const executionId = await this.recordExecutionStart(message.taskId);

      try {
        const result = await handler.handle(message, this.env, executionContext);

        if (result.status === "error") {
          throw new Error(result.message || "Unknown error during task execution");
        }

        const executionTime = Date.now() - startTime;

        await lease.assertOwned();
        await this.recordExecutionSuccess(executionId, executionTime, result);

        const settled = await this.taskRepository.updateOwnedTask(message.taskId, ownerToken, {
          status: "completed",
          completed_at: new Date().toISOString(),
        });

        if (!settled) {
          throw new TaskExecutionOwnershipLostError();
        }

        logger.info(`Task ${message.taskId} completed successfully in ${executionTime}ms`);
      } catch (error) {
        const executionTime = Date.now() - startTime;

        await this.recordExecutionFailure(executionId, executionTime, error as Error);

        if (error instanceof TaskExecutionLeaseBusyError) {
          await lease.assertOwned();
          const released = await this.taskRepository.updateOwnedTask(message.taskId, ownerToken, {
            status: "queued",
          });

          if (!released) {
            throw new TaskExecutionOwnershipLostError();
          }

          throw error;
        }

        if (isTaskExecutionOwnershipLostError(error)) {
          throw error;
        }

        await lease.assertOwned();

        const task = await this.taskRepository.getTaskById(message.taskId);

        if (task) {
          const newAttempts = (task.attempts || 0) + 1;

          if (newAttempts >= (task.max_attempts || 3)) {
            // Keep the task claim retryable until its handler has durably reconciled external state.
            await handler.onFinalFailure?.(message, this.env, error as Error, executionContext);

            const settled = await this.taskRepository.updateOwnedTask(message.taskId, ownerToken, {
              status: "failed",
              attempts: newAttempts,
              error_message: (error as Error).message,
            });

            if (!settled) {
              throw new TaskExecutionOwnershipLostError();
            }

            logger.error(`Task ${message.taskId} failed after ${newAttempts} attempts`);
          } else {
            const settled = await this.taskRepository.updateOwnedTask(message.taskId, ownerToken, {
              status: "queued",
              attempts: newAttempts,
              error_message: (error as Error).message,
            });

            if (!settled) {
              throw new TaskExecutionOwnershipLostError();
            }

            logger.warn(
              `Task ${message.taskId} failed, attempt ${newAttempts}/${task.max_attempts}`,
            );
          }
        }

        throw error;
      } finally {
        await lease.stop();
      }
    } catch (error) {
      logger.error(`Task execution error for ${message.taskId}:`, error);
      throw error;
    }
  }

  private async recordExecutionStart(taskId: string): Promise<string> {
    const execution = await this.taskRepository.createTaskExecution(taskId, "running");

    return execution?.id || generateId();
  }

  private async recordExecutionSuccess(
    executionId: string,
    executionTimeMs: number,
    result: TaskResult,
  ): Promise<void> {
    await this.taskRepository.updateTaskExecution(
      executionId,
      "completed",
      executionTimeMs,
      undefined,
      result.data,
    );
  }

  private async recordExecutionFailure(
    executionId: string,
    executionTimeMs: number,
    error: Error,
  ): Promise<void> {
    await this.taskRepository.updateTaskExecution(
      executionId,
      "failed",
      executionTimeMs,
      error.message,
      { stack: error.stack },
    );
  }

  public async handleFailure(message: TaskMessage, error: Error): Promise<void> {
    logger.error(`Task ${message.taskId} moved to DLQ:`, error);

    await this.taskRepository.updateTask(message.taskId, {
      status: "failed",
      error_message: error.message,
    });
  }
}
