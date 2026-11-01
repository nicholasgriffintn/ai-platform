import type {
  TaskEnqueueRequest as WorkflowTaskEnqueueRequest,
  TaskHandler as WorkflowTaskHandler,
  TaskMessage as WorkflowTaskMessage,
} from "@ngriffin_uk/polychat-ai-workflows";
import type { TaskType } from "@ngriffin_uk/polychat-schemas";

import type { IEnv } from "~/types";

export type {
  TaskExecutionContext,
  TaskExecutionFence,
  TaskResult,
  TaskSteps,
} from "@ngriffin_uk/polychat-ai-workflows";

export type TaskHandler = WorkflowTaskHandler<IEnv, TaskType>;
export type TaskMessage = WorkflowTaskMessage<TaskType>;
export type TaskDefinition = WorkflowTaskEnqueueRequest<TaskType>;

export type TaskStepOutcome =
  | { status: "run" }
  | { status: "done" }
  | { status: "wait"; seconds: number };

export interface TaskStep {
  do(
    name: string,
    options: { retries: number },
    run: (attempt: number) => Promise<TaskStepOutcome>,
  ): Promise<TaskStepOutcome>;
  text(name: string, options: { retries: number }, run: () => Promise<string>): Promise<string>;
  sleep(name: string, seconds: number): Promise<void>;
  sleepUntil(name: string, at: Date): Promise<void>;
}
