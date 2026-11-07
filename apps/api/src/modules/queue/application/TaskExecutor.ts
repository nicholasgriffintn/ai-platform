import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { inlineTaskSteps } from "@ngriffin_uk/polychat-ai-workflows";
import {
  busyRetryDelaySeconds,
  finalFailureError,
  isTaskError,
  ownershipLostError,
  settleTaskFailure,
  settleTaskSuccess,
  DEFAULT_TASK_MAX_ATTEMPTS,
  type TaskHandlerRegistry,
} from "@ngriffin_uk/polychat-library-tasks";
import { generateId, isRecord, readOptionalString } from "@ngriffin_uk/polychat-utility-core";
import {
  getErrorMessage,
  isConfigurationError,
  toError,
} from "@ngriffin_uk/polychat-utility-server/errors";
import { z } from "zod/v4";

import { evaluateServerFlag, isTaskFlagType, taskFlags } from "~/modules/experiments/application";
import {
  TaskRepository,
  type UpdateTaskParams,
} from "~/modules/queue/infrastructure/TaskRepository";
import type { IEnv } from "~/types";

import type {
  TaskExecutionContext,
  TaskExecutionFence,
  TaskHandler,
  TaskMessage,
  TaskResult,
  TaskStep,
  TaskStepOutcome,
  TaskSteps,
} from "./types";

const logger = getLogger({ prefix: "services/tasks/executor" });

const BOOKKEEPING_RETRIES = 5;
const DONE: TaskStepOutcome = { status: "done" };
const durableClaimSchema = z.object({ ownerToken: z.string() });

export function describeTaskFailure(result: Pick<TaskResult, "message" | "data">): string {
  const message = result.message || "Unknown error during task execution";
  const detail = isRecord(result.data) ? readOptionalString(result.data.error) : undefined;

  return detail ? `${message}: ${detail}` : message;
}

export class TaskExecutor {
  private env: IEnv;
  private handlers: TaskHandlerRegistry<TaskHandler>;
  private taskRepository: TaskRepository;

  constructor(env: IEnv, handlers: TaskHandlerRegistry<TaskHandler>) {
    this.env = env;
    this.handlers = handlers;
    this.taskRepository = new TaskRepository(env);
  }

  public async run(message: TaskMessage, instanceId: string, step: TaskStep): Promise<void> {
    const scheduledAt = message.scheduled_at ? Date.parse(message.scheduled_at) : Number.NaN;
    const secondsUntilDue = Math.ceil((scheduledAt - Date.now()) / 1000);

    if (secondsUntilDue > 0) {
      await step.sleep("scheduled", secondsUntilDue);
    }

    const admission = await step.do("admit", { retries: BOOKKEEPING_RETRIES }, () =>
      this.admit(message),
    );

    if (admission.status !== "run") {
      return;
    }

    if (this.handlers.resolve(message.task_type).durable) {
      await this.runDurable(message, instanceId, step);

      return;
    }

    for (let pollAttempt = 0; ; pollAttempt++) {
      const name = pollAttempt === 0 ? "run" : `run-${pollAttempt}`;
      let outcome: TaskStepOutcome;

      try {
        outcome = await step.do(name, { retries: this.retries(message) }, (attempt) =>
          this.attempt(message, instanceId, name, attempt, pollAttempt),
        );
      } catch (error) {
        await step.do(`${name}-settle`, { retries: BOOKKEEPING_RETRIES }, async () => {
          await this.taskRepository.failOpenTask(message.taskId, getErrorMessage(error));

          return DONE;
        });

        throw error;
      }

      if (outcome.status !== "wait") {
        return;
      }

      await step.sleep(`wait-${pollAttempt + 1}`, outcome.seconds);
    }
  }

  private async runDurable(message: TaskMessage, instanceId: string, step: TaskStep) {
    const handler = this.handlers.resolve(message.task_type);
    const claim = await step.text("claim", { retries: BOOKKEEPING_RETRIES }, async () => {
      const ownerToken = `${instanceId}:${generateId()}`;
      const claimed = await this.taskRepository.claimTaskForExecution(message.taskId, {
        ownerToken,
        instanceId,
      });

      if (!claimed) {
        return "";
      }

      return JSON.stringify({ ownerToken });
    });

    if (!claim) {
      logger.info(`Task ${message.taskId} is not claimable by this run, skipping`);

      return;
    }

    const { ownerToken } = durableClaimSchema.parse(JSON.parse(claim));
    const fence = this.fence(message.taskId, ownerToken);
    const retries = this.retries(message);
    const steps: TaskSteps = {
      run: async (name, work) => {
        await step.text(name, { retries }, () =>
          this.recordStep(message.taskId, name, async () => {
            await fence.assertOwned();
            await work();

            return "";
          }),
        );
      },
      value: async (name, schema, work) => {
        const stored = await step.text(name, { retries }, () =>
          this.recordStep(message.taskId, name, async () => {
            await fence.assertOwned();

            return JSON.stringify((await work()) ?? null);
          }),
        );

        return schema.parse(JSON.parse(stored));
      },
    };
    const execution: TaskExecutionContext = {
      attempt: 1,
      isRetry: false,
      pollAttempt: 0,
      fence,
      steps,
    };

    try {
      const result = await handler.handle(message, this.env, execution);

      if (result.status === "error") {
        throw new Error(describeTaskFailure(result));
      }

      await step.text("settle", { retries: BOOKKEEPING_RETRIES }, async () => {
        const settlement = settleTaskSuccess(result);

        await this.taskRepository.updateOwnedTask(
          message.taskId,
          ownerToken,
          settlement.status === "suspended"
            ? { status: "suspended" }
            : { status: "completed", completed_at: settlement.completedAt },
        );

        return "";
      });
    } catch (error) {
      await step.text("fail", { retries: BOOKKEEPING_RETRIES }, async () => {
        if (
          !(await this.taskRepository.isTaskExecutionOwner({ taskId: message.taskId, ownerToken }))
        ) {
          return "";
        }

        await handler.onFinalFailure?.(message, this.env, toError(error), execution);
        await this.taskRepository.updateOwnedTask(message.taskId, ownerToken, {
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: getErrorMessage(error),
        });

        return "";
      });

      throw error;
    }
  }

  private retries(message: TaskMessage): number {
    return Math.max(0, (message.max_attempts ?? DEFAULT_TASK_MAX_ATTEMPTS) - 1);
  }

  private async admit(message: TaskMessage): Promise<TaskStepOutcome> {
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

      return DONE;
    }

    if (!this.handlers.has(message.task_type)) {
      await this.taskRepository.updateTask(message.taskId, {
        status: "cancelled",
        completed_at: new Date().toISOString(),
        error_message: `Unknown task type: ${message.task_type}`,
      });
      logger.warn(`Unknown task type ${message.task_type} was cancelled`);

      return DONE;
    }

    return { status: "run" };
  }

  private async attempt(
    message: TaskMessage,
    instanceId: string,
    stepName: string,
    attempt: number,
    pollAttempt: number,
  ): Promise<TaskStepOutcome> {
    const handler = this.handlers.resolve(message.task_type);
    const ownerToken = `${instanceId}:${generateId()}`;
    const claimed = await this.taskRepository.claimTaskForExecution(message.taskId, {
      ownerToken,
      instanceId,
    });

    if (!claimed) {
      logger.info(`Task ${message.taskId} is not claimable by this run, skipping`);

      return DONE;
    }

    if (attempt > 1) {
      await this.taskRepository.failRunningTaskExecutions(
        message.taskId,
        "The previous attempt ended before recording an outcome.",
      );
    }

    const fence = this.fence(message.taskId, ownerToken);
    const execution: TaskExecutionContext = {
      attempt,
      isRetry: attempt > 1,
      pollAttempt,
      fence,
      steps: inlineTaskSteps,
    };
    const startTime = Date.now();
    const executionId = await this.recordExecutionStart(message.taskId, stepName);

    try {
      const result = await handler.handle(message, this.env, execution);

      if (result.status === "error") {
        throw new Error(describeTaskFailure(result));
      }

      await fence.assertOwned();
      await this.recordExecutionSuccess(executionId, Date.now() - startTime, result);

      if (result.status === "pending") {
        await this.settle(message.taskId, ownerToken, { status: "queued" });

        return { status: "wait", seconds: Math.max(1, result.retryAfterSeconds ?? 1) };
      }

      const settlement = settleTaskSuccess(result);

      await this.settle(
        message.taskId,
        ownerToken,
        settlement.status === "suspended"
          ? { status: "suspended" }
          : { status: "completed", completed_at: settlement.completedAt },
      );

      return DONE;
    } catch (error) {
      await this.recordExecutionFailure(executionId, Date.now() - startTime, toError(error));

      if (isTaskError(error, "ownership_lost")) {
        logger.info(`Task ${message.taskId} moved on without this run, stopping`);

        return DONE;
      }

      if (isTaskError(error, "lease_busy")) {
        await this.settle(message.taskId, ownerToken, { status: "queued" });

        return { status: "wait", seconds: busyRetryDelaySeconds(error) };
      }

      const settlement = settleTaskFailure(error, {
        attempts: attempt - 1,
        maxAttempts: message.max_attempts ?? DEFAULT_TASK_MAX_ATTEMPTS,
        retryable: !isConfigurationError(error) && !isTaskError(error, "invalid_payload"),
      });

      if (settlement.status === "failed") {
        await handler.onFinalFailure?.(message, this.env, toError(error), execution);
        await this.settle(message.taskId, ownerToken, {
          status: "failed",
          attempts: settlement.attempts,
          completed_at: new Date().toISOString(),
          error_message: settlement.error,
        });
        logger.error(`Task ${message.taskId} failed after ${settlement.attempts} attempts`);

        throw finalFailureError(message.taskId, error);
      }

      await this.settle(message.taskId, ownerToken, {
        status: "queued",
        attempts: settlement.attempts,
        error_message: settlement.error,
      });
      logger.warn(
        `Task ${message.taskId} failed, attempt ${settlement.attempts}/${message.max_attempts ?? DEFAULT_TASK_MAX_ATTEMPTS}`,
      );

      throw error;
    }
  }

  private fence(taskId: string, ownerToken: string): TaskExecutionFence {
    return {
      ownerToken,
      assertOwned: async () => {
        if (!(await this.taskRepository.isTaskExecutionOwner({ taskId, ownerToken }))) {
          throw ownershipLostError(taskId);
        }
      },
    };
  }

  private async settle(
    taskId: string,
    ownerToken: string,
    params: UpdateTaskParams,
  ): Promise<void> {
    if (!(await this.taskRepository.updateOwnedTask(taskId, ownerToken, params))) {
      throw ownershipLostError(taskId);
    }
  }

  private async recordStep(taskId: string, name: string, work: () => Promise<string>) {
    const startedAt = Date.now();
    const executionId = await this.recordExecutionStart(taskId, name);

    try {
      const value = await work();

      await this.taskRepository.updateTaskExecution(
        executionId,
        "completed",
        Date.now() - startedAt,
      );

      return value;
    } catch (error) {
      await this.recordExecutionFailure(executionId, Date.now() - startedAt, toError(error));

      throw error;
    }
  }

  private async recordExecutionStart(taskId: string, step: string): Promise<string> {
    const execution = await this.taskRepository.createTaskExecution(taskId, step);

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
}
