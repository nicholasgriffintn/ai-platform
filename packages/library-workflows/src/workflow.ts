import { withRetry } from "@ngriffin_uk/polychat-utility-server/retries";

export type WorkflowStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type WorkflowStatus = "pending" | "running" | "completed" | "failed" | "paused";

export interface WorkflowRetryPolicy {
  attempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
}

export interface WorkflowStepRun<TContext> {
  attempt: number;
  results: Record<string, unknown>;
  context: TContext;
  signal?: AbortSignal;
}

export interface WorkflowStep<TContext, TResult = unknown> {
  name: string;
  run: (context: TContext, step: WorkflowStepRun<TContext>) => Promise<TResult> | TResult;
  retry?: WorkflowRetryPolicy;
  skipIf?: (context: TContext, results: Record<string, unknown>) => boolean;
  optional?: boolean;
}

export interface WorkflowDefinition<TContext> {
  name: string;
  steps: WorkflowStep<TContext, any>[];
}

export interface WorkflowStepState {
  status: WorkflowStepStatus;
  attempts: number;
  startedAt?: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
}

export interface WorkflowState {
  workflow: string;
  status: WorkflowStatus;
  startedAt?: number;
  completedAt?: number;
  steps: Record<string, WorkflowStepState>;
  error?: string;
}

export type WorkflowEvent =
  | { type: "workflow.started"; workflow: string }
  | { type: "workflow.completed"; workflow: string }
  | { type: "workflow.failed"; workflow: string; step: string; error: string }
  | { type: "workflow.paused"; workflow: string; step: string }
  | { type: "step.started"; workflow: string; step: string; attempt: number }
  | { type: "step.completed"; workflow: string; step: string; result: unknown }
  | { type: "step.skipped"; workflow: string; step: string }
  | { type: "step.retrying"; workflow: string; step: string; attempt: number; error: string }
  | { type: "step.failed"; workflow: string; step: string; error: string };

export interface RunWorkflowOptions<TContext> {
  state?: WorkflowState;
  signal?: AbortSignal;
  onEvent?: (event: WorkflowEvent) => Promise<void> | void;
  persist?: (state: WorkflowState) => Promise<void> | void;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  context?: TContext;
}

export interface WorkflowRunResult {
  state: WorkflowState;
  results: Record<string, unknown>;
}

export class WorkflowPausedError extends Error {
  constructor(readonly step: string) {
    super(`Workflow paused at step "${step}"`);
    this.name = "WorkflowPausedError";
  }
}

export function defineWorkflow<TContext>(
  definition: WorkflowDefinition<TContext>,
): WorkflowDefinition<TContext> {
  const names = new Set<string>();

  for (const step of definition.steps) {
    if (names.has(step.name)) {
      throw new Error(`Workflow "${definition.name}" defines step "${step.name}" twice`);
    }

    names.add(step.name);
  }

  return definition;
}

export function createWorkflowState<TContext>(
  definition: WorkflowDefinition<TContext>,
): WorkflowState {
  return {
    workflow: definition.name,
    status: "pending",
    steps: Object.fromEntries(
      definition.steps.map((step) => [step.name, { status: "pending", attempts: 0 }]),
    ),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runWorkflow<TContext>(
  definition: WorkflowDefinition<TContext>,
  context: TContext,
  options: RunWorkflowOptions<TContext> = {},
): Promise<WorkflowRunResult> {
  const now = options.now ?? Date.now;
  const state = options.state ?? createWorkflowState(definition);
  const emit = async (event: WorkflowEvent) => {
    await options.onEvent?.(event);
  };

  const persist = async () => {
    await options.persist?.(state);
  };

  const results: Record<string, unknown> = Object.fromEntries(
    Object.entries(state.steps)
      .filter(([, step]) => step.status === "completed")
      .map(([name, step]) => [name, step.result]),
  );

  if (state.workflow !== definition.name) {
    throw new Error(`State belongs to workflow "${state.workflow}", not "${definition.name}"`);
  }

  if (state.status === "pending") {
    state.status = "running";
    state.startedAt = now();
    await emit({ type: "workflow.started", workflow: definition.name });
  } else {
    state.status = "running";
  }

  await persist();

  for (const step of definition.steps) {
    const stepState = (state.steps[step.name] ??= { status: "pending", attempts: 0 });

    if (stepState.status === "completed" || stepState.status === "skipped") {
      continue;
    }

    if (options.signal?.aborted) {
      state.status = "paused";
      await persist();
      await emit({ type: "workflow.paused", workflow: definition.name, step: step.name });
      throw new WorkflowPausedError(step.name);
    }

    if (step.skipIf?.(context, results)) {
      stepState.status = "skipped";
      await persist();
      await emit({ type: "step.skipped", workflow: definition.name, step: step.name });
      continue;
    }

    stepState.status = "running";
    stepState.startedAt = now();
    await persist();

    try {
      const result = await withRetry(
        async (attempt) => {
          stepState.attempts += 1;
          await emit({ type: "step.started", workflow: definition.name, step: step.name, attempt });

          return step.run(context, { attempt, results, context, signal: options.signal });
        },
        {
          maxAttempts: step.retry?.attempts ?? 1,
          baseDelayMs: step.retry?.baseDelayMs ?? 0,
          maxDelayMs: step.retry?.maxDelayMs,
          jitterRatio: 0,
          isRetryableError: step.retry?.isRetryable ?? (() => true),
          shouldCancel: () => Boolean(options.signal?.aborted),
          sleep: options.sleep,
          onRetryScheduled: (schedule) =>
            emit({
              type: "step.retrying",
              workflow: definition.name,
              step: step.name,
              attempt: schedule.attempt,
              error: errorMessage(schedule.error),
            }),
        },
      );

      stepState.status = "completed";
      stepState.completedAt = now();
      stepState.result = result;
      results[step.name] = result;
      await persist();
      await emit({ type: "step.completed", workflow: definition.name, step: step.name, result });
    } catch (error) {
      const message = errorMessage(error);

      if (options.signal?.aborted) {
        stepState.status = "pending";
        state.status = "paused";
        await persist();
        await emit({ type: "workflow.paused", workflow: definition.name, step: step.name });
        throw new WorkflowPausedError(step.name);
      }

      stepState.status = "failed";
      stepState.completedAt = now();
      stepState.error = message;
      await emit({
        type: "step.failed",
        workflow: definition.name,
        step: step.name,
        error: message,
      });

      if (step.optional) {
        await persist();
        continue;
      }

      state.status = "failed";
      state.error = message;
      state.completedAt = now();
      await persist();
      await emit({
        type: "workflow.failed",
        workflow: definition.name,
        step: step.name,
        error: message,
      });

      return { state, results };
    }
  }

  state.status = "completed";
  state.completedAt = now();
  await persist();
  await emit({ type: "workflow.completed", workflow: definition.name });

  return { state, results };
}
