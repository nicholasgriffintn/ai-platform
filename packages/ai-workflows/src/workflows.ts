import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  createTaskHandlerRegistry,
  pollingSchedule,
  TaskError,
  type TaskHandlerRegistry,
} from "@ngriffin_uk/polychat-library-tasks";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  PENDING,
  type CronContext,
  type CronEvent,
  type CronRunReport,
  type PayloadSchema,
  type PollDefinition,
  type RawTaskDefinition,
  type ScheduleDefinition,
  type TaskContext,
  type TaskDefinition,
  type TaskEnqueueRequest,
  type TaskExecutionContext,
  type TaskHandler,
  type TaskMessage,
  type TaskQueue,
  type TaskResult,
} from "./types.js";

const logger = getLogger({ prefix: "ai-workflows" });

export interface CreateWorkflowsOptions<TEnv, TType extends string> {
  queue: (env: TEnv) => TaskQueue<TType>;
  now?: () => number;
}

export interface Workflows<TEnv, TType extends string = string> {
  on<TPayload>(type: TType, definition: TaskDefinition<TEnv, TPayload, TType>): void;
  on(type: TType, definition: RawTaskDefinition<TEnv, TType>): void;
  poll<TPayload>(type: TType, definition: PollDefinition<TEnv, TPayload, TType>): void;
  register(type: TType, handler: TaskHandler<TEnv, TType>): void;
  every(cron: string, definition: ScheduleDefinition<TEnv, TType>): void;
  always(definition: ScheduleDefinition<TEnv, TType>): void;
  enqueue(env: TEnv, request: TaskEnqueueRequest<TType>): Promise<string>;
  handlers(): TaskHandlerRegistry<TaskHandler<TEnv, TType>>;
  crons(): string[];
  runCron(env: TEnv, event: CronEvent): Promise<CronRunReport>;
}

export const POLL_ATTEMPT_FIELD = "pollAttempt";

function readPollAttempt(taskData: Record<string, unknown>): number | undefined {
  const value = taskData[POLL_ATTEMPT_FIELD];

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function createWorkflows<TEnv, TType extends string = string>(
  options: CreateWorkflowsOptions<TEnv, TType>,
): Workflows<TEnv, TType> {
  const registry = createTaskHandlerRegistry<TaskHandler<TEnv, TType>>();
  const schedules = new Map<string, ScheduleDefinition<TEnv, TType>[]>();
  const everyTick: ScheduleDefinition<TEnv, TType>[] = [];
  const now = options.now ?? Date.now;

  const taskContext = (
    env: TEnv,
    message: TaskMessage<TType>,
    execution: TaskExecutionContext,
  ): TaskContext<TEnv, TType> => {
    const queue = options.queue(env);

    return { env, message, execution, queue, enqueue: (request) => queue.enqueue(request) };
  };

  const parsePayload = <TPayload>(
    type: TType,
    schema: PayloadSchema<TPayload>,
    taskData: Record<string, unknown>,
  ): TPayload => {
    const parsed = schema.safeParse(taskData);

    if (!parsed.success) {
      throw new TaskError(
        "invalid_payload",
        `Invalid payload for task "${type}": ${parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ")}`,
        { type },
      );
    }

    return parsed.data;
  };

  const buildHandler = <TPayload>(
    read: (taskData: Record<string, unknown>) => TPayload,
    handle: (payload: TPayload, context: TaskContext<TEnv, TType>) => Promise<TaskResult | void>,
    onFinalFailure?: (
      payload: TPayload,
      error: Error,
      context: TaskContext<TEnv, TType>,
    ) => Promise<void>,
  ): TaskHandler<TEnv, TType> => ({
    handle: async (message, env, execution) => {
      const result = await handle(read(message.task_data), taskContext(env, message, execution));

      return result ?? { status: "success" };
    },
    onFinalFailure: onFinalFailure
      ? async (message, env, error, execution) =>
          onFinalFailure(read(message.task_data), error, taskContext(env, message, execution))
      : undefined,
  });

  function on<TPayload>(type: TType, definition: TaskDefinition<TEnv, TPayload, TType>): void;
  function on(type: TType, definition: RawTaskDefinition<TEnv, TType>): void;
  function on<TPayload>(
    type: TType,
    definition: TaskDefinition<TEnv, TPayload, TType> | RawTaskDefinition<TEnv, TType>,
  ): void {
    if (definition.payload) {
      const schema = definition.payload;

      registry.register(
        type,
        buildHandler(
          (taskData) => parsePayload(type, schema, taskData),
          definition.handle,
          definition.onFinalFailure,
        ),
      );

      return;
    }

    registry.register(
      type,
      buildHandler((taskData) => taskData, definition.handle, definition.onFinalFailure),
    );
  }

  const poll: Workflows<TEnv, TType>["poll"] = (type, definition) => {
    on(type, {
      payload: definition.payload,
      handle: async (payload, context) => {
        const outcome = await definition.check(payload, context);

        if (outcome !== PENDING) {
          return outcome;
        }

        const schedule = pollingSchedule({
          attempt: readPollAttempt(context.message.task_data),
          delaysSeconds: definition.delaysSeconds,
          maxAttempts: definition.maxAttempts,
          now,
        });

        if (schedule.exhausted) {
          const exhausted = await definition.onExhausted?.(payload, context);

          return (
            exhausted ?? {
              status: "error",
              message: `Polling for "${type}" gave up after ${schedule.attempt - 1} attempts`,
            }
          );
        }

        await context.enqueue({
          task_type: type,
          user_id: context.message.user_id,
          project_id: context.message.project_id,
          task_data: { ...context.message.task_data, [POLL_ATTEMPT_FIELD]: schedule.attempt },
          schedule_type: "scheduled",
          scheduled_at: schedule.scheduledAt,
          priority: context.message.priority,
        });

        return {
          status: "success",
          message: `Still pending, polling again in ${schedule.delaySeconds}s`,
          data: { pollAttempt: schedule.attempt, scheduledAt: schedule.scheduledAt },
        };
      },
    });
  };

  const runSchedule = async (
    definition: ScheduleDefinition<TEnv, TType>,
    context: CronContext<TEnv, TType>,
    report: CronRunReport,
  ): Promise<void> => {
    if (definition.enabledWhen && !definition.enabledWhen(context.env)) {
      report.skipped.push(definition.name);

      return;
    }

    try {
      await definition.run(context);
      report.matched.push(definition.name);
    } catch (error) {
      report.failed.push({ name: definition.name, error });
      logger.error(`Scheduled job "${definition.name}" failed`, {
        cron: context.event.cron,
        error: getErrorMessage(error),
      });
    }
  };

  return {
    on,
    poll,
    register: (type, handler) => registry.register(type, handler),
    every: (cron, definition) => {
      schedules.set(cron, [...(schedules.get(cron) ?? []), definition]);
    },
    always: (definition) => {
      everyTick.push(definition);
    },
    enqueue: (env, request) => options.queue(env).enqueue(request),
    handlers: () => registry,
    crons: () => [...schedules.keys()],
    runCron: async (env, event) => {
      const queue = options.queue(env);
      const context: CronContext<TEnv, TType> = {
        env,
        event,
        invokedAt: new Date(event.scheduledTime),
        queue,
        enqueue: (request) => queue.enqueue(request),
      };
      const report: CronRunReport = { cron: event.cron, matched: [], skipped: [], failed: [] };
      const matching = schedules.get(event.cron) ?? [];

      for (const definition of everyTick) {
        await runSchedule(definition, context, report);
      }

      if (matching.length === 0) {
        logger.warn(`No scheduled jobs are registered for cron "${event.cron}"`);
      }

      for (const definition of matching) {
        await runSchedule(definition, context, report);
      }

      return report;
    },
  };
}
