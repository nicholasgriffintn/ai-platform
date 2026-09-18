import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  createExecutionLease,
  isTaskError,
  leaseBusyError,
  leaseExpiry,
  ownershipLostError,
  settleTaskFailure,
  settleTaskSuccess,
  DEFAULT_TASK_MAX_ATTEMPTS,
  type TaskHandlerRegistry,
} from "@ngriffin_uk/polychat-library-tasks";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import { TaskRepository } from "~/repositories/TaskRepository";
import { evaluateServerFlag, isTaskFlagType, taskFlags } from "~/services/experiments";
import type { IEnv } from "~/types";

import { taskLeaseStore } from "./lease-store";
import type { TaskExecutionContext, TaskHandler, TaskMessage, TaskResult } from "./types";

const logger = getLogger({ prefix: "services/tasks/executor" });

export class TaskExecutor {
  private env: IEnv;
  private handlers: TaskHandlerRegistry<TaskHandler>;
  private taskRepository: TaskRepository;

  constructor(env: IEnv, handlers: TaskHandlerRegistry<TaskHandler>) {
    this.env = env;
    this.handlers = handlers;
    this.taskRepository = new TaskRepository(env);
  }

  public async execute(message: TaskMessage, deliveryAttempt = 1): Promise<void> {
    const startTime = Date.now();
    const isRedelivery = deliveryAttempt > 1;

    try {
      if (
        isTaskFlagType(message.task_type) &&
        !(await evaluateServerFlag(this.env, taskFlags(this.env)[message.task_type]))
      ) {
        await this.taskRepository.updateTask(message.taskId, {
          status: "cancelled",
          completed_at: new Date().toISOString(),
          error_message: `Task type ${message.task_type} is disabled by its feature flag`,
        });
        logger.info(`Task type ${message.task_type} is disabled by its feature flag`);

        return;
      }

      if (!this.handlers.has(message.task_type)) {
        await this.taskRepository.updateTask(message.taskId, {
          status: "cancelled",
          completed_at: new Date().toISOString(),
          error_message: `Unknown task type: ${message.task_type}`,
        });
        logger.warn(`Unknown task type ${message.task_type} was cancelled`);

        return;
      }

      const handler = this.handlers.resolve(message.task_type);

      const ownerToken = generateId();
      const leaseExpiresAt = leaseExpiry();
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
          throw leaseBusyError(message.taskId, currentTask.execution_lease_expires_at);
        }

        logger.info(`Task ${message.taskId} is not claimable, skipping duplicate delivery`);

        return;
      }

      const lease = createExecutionLease({
        store: taskLeaseStore(this.taskRepository),
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

        const settlement = settleTaskSuccess(result);
        const settled = await this.taskRepository.updateOwnedTask(
          message.taskId,
          ownerToken,
          settlement.status === "suspended"
            ? { status: "suspended" }
            : { status: "completed", completed_at: settlement.completedAt },
        );

        if (!settled) {
          throw ownershipLostError(message.taskId);
        }

        logger.info(
          result.status === "suspended"
            ? `Task ${message.taskId} suspended in ${executionTime}ms`
            : `Task ${message.taskId} completed successfully in ${executionTime}ms`,
        );
      } catch (error) {
        const executionTime = Date.now() - startTime;

        await this.recordExecutionFailure(executionId, executionTime, error as Error);

        if (isTaskError(error, "lease_busy")) {
          await lease.assertOwned();
          const released = await this.taskRepository.updateOwnedTask(message.taskId, ownerToken, {
            status: "queued",
          });

          if (!released) {
            throw ownershipLostError(message.taskId);
          }

          throw error;
        }

        if (isTaskError(error, "ownership_lost")) {
          throw error;
        }

        await lease.assertOwned();

        const task = await this.taskRepository.getTaskById(message.taskId);

        if (task) {
          const settlement = settleTaskFailure(error, {
            attempts: task.attempts || 0,
            maxAttempts: task.max_attempts || DEFAULT_TASK_MAX_ATTEMPTS,
          });

          if (settlement.status === "failed") {
            await handler.onFinalFailure?.(message, this.env, error as Error, executionContext);
          }

          const settled = await this.taskRepository.updateOwnedTask(message.taskId, ownerToken, {
            status: settlement.status,
            attempts: settlement.attempts,
            error_message: settlement.error,
          });

          if (!settled) {
            throw ownershipLostError(message.taskId);
          }

          if (settlement.status === "failed") {
            logger.error(`Task ${message.taskId} failed after ${settlement.attempts} attempts`);
          } else {
            logger.warn(
              `Task ${message.taskId} failed, attempt ${settlement.attempts}/${task.max_attempts}`,
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
