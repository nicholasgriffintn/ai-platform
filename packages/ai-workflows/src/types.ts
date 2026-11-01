import type { TaskResult } from "@ngriffin_uk/polychat-library-tasks";
import type { z } from "zod/v4";

export type { TaskResult } from "@ngriffin_uk/polychat-library-tasks";

export type TaskScheduleType = "immediate" | "scheduled" | "recurring" | "event_triggered";

export interface TaskMessage<TType extends string = string> {
  taskId: string;
  task_type: TType;
  user_id?: number;
  project_id?: string;
  task_data: Record<string, unknown>;
  priority: number;
  schedule_type?: TaskScheduleType;
  scheduled_at?: string;
  max_attempts?: number;
}

export interface TaskEnqueueRequest<TType extends string = string> {
  id?: string;
  task_type: TType;
  user_id?: number;
  project_id?: string;
  task_data: Record<string, unknown>;
  schedule_type?: TaskScheduleType;
  scheduled_at?: string;
  cron_expression?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface TaskQueue<TType extends string = string> {
  enqueue(request: TaskEnqueueRequest<TType>): Promise<string>;
}

export interface TaskExecutionFence {
  ownerToken: string;
  assertOwned(): Promise<void>;
}

export interface TaskSteps {
  run(name: string, work: () => Promise<void>): Promise<void>;
  value<T>(name: string, schema: PayloadSchema<T>, work: () => Promise<T>): Promise<T>;
}

export interface TaskExecutionContext {
  attempt: number;
  isRetry: boolean;
  pollAttempt: number;
  fence: TaskExecutionFence;
  steps: TaskSteps;
}

export interface TaskHandler<TEnv, TType extends string = string> {
  durable?: boolean;
  handle(
    message: TaskMessage<TType>,
    env: TEnv,
    context: TaskExecutionContext,
  ): Promise<TaskResult>;
  onFinalFailure?(
    message: TaskMessage<TType>,
    env: TEnv,
    error: Error,
    context: TaskExecutionContext,
  ): Promise<void>;
}

export interface TaskContext<TEnv, TType extends string = string> {
  env: TEnv;
  message: TaskMessage<TType>;
  execution: TaskExecutionContext;
  queue: TaskQueue<TType>;
  enqueue(request: TaskEnqueueRequest<TType>): Promise<string>;
}

export type PayloadSchema<TPayload> = z.ZodType<TPayload>;

export interface TaskDefinition<TEnv, TPayload, TType extends string = string> {
  payload: PayloadSchema<TPayload>;
  durable?: boolean;
  handle: (payload: TPayload, context: TaskContext<TEnv, TType>) => Promise<TaskResult | void>;
  onFinalFailure?: (
    payload: TPayload,
    error: Error,
    context: TaskContext<TEnv, TType>,
  ) => Promise<void>;
}

export interface RawTaskDefinition<TEnv, TType extends string = string> {
  payload?: undefined;
  handle: (
    payload: Record<string, unknown>,
    context: TaskContext<TEnv, TType>,
  ) => Promise<TaskResult | void>;
  onFinalFailure?: (
    payload: Record<string, unknown>,
    error: Error,
    context: TaskContext<TEnv, TType>,
  ) => Promise<void>;
}

export type PollOutcome = TaskResult | typeof PENDING;

export const PENDING: unique symbol = Symbol("polling-pending");

export interface PollDefinition<TEnv, TPayload, TType extends string = string> {
  payload: PayloadSchema<TPayload>;
  delaysSeconds?: readonly number[];
  maxAttempts?: number;
  check(payload: TPayload, context: TaskContext<TEnv, TType>): Promise<PollOutcome>;
  onExhausted?(payload: TPayload, context: TaskContext<TEnv, TType>): Promise<TaskResult | void>;
}

export interface CronEvent {
  cron: string;
  scheduledTime: number;
}

export interface CronContext<TEnv, TType extends string = string> {
  env: TEnv;
  event: CronEvent;
  invokedAt: Date;
  queue: TaskQueue<TType>;
  enqueue(request: TaskEnqueueRequest<TType>): Promise<string>;
}

export interface ScheduleDefinition<TEnv, TType extends string = string> {
  name: string;
  enabledWhen?(env: TEnv): boolean | Promise<boolean>;
  run(context: CronContext<TEnv, TType>): Promise<void>;
}

export interface CronRunReport {
  cron: string;
  matched: string[];
  skipped: string[];
  failed: Array<{ name: string; error: unknown }>;
}
