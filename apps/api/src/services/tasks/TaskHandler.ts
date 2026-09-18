import type { ExecutionLease, TaskResult } from "@ngriffin_uk/polychat-library-tasks";

import type { IEnv } from "~/types";

import type { TaskMessage } from "./TaskService";

export type { TaskResult } from "@ngriffin_uk/polychat-library-tasks";

export type TaskExecutionLease = Pick<ExecutionLease, "ownerToken" | "expiresAt" | "assertOwned">;

export interface TaskExecutionContext {
  deliveryAttempt: number;
  isRedelivery: boolean;
  lease: TaskExecutionLease;
}

export interface TaskHandler {
  handle(message: TaskMessage, env: IEnv, context: TaskExecutionContext): Promise<TaskResult>;
  onFinalFailure?(
    message: TaskMessage,
    env: IEnv,
    error: Error,
    context: TaskExecutionContext,
  ): Promise<void>;
}
