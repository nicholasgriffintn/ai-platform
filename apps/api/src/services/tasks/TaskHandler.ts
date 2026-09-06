import type { IEnv } from "~/types";

import type { TaskMessage } from "./TaskService";

export interface TaskResult {
  status: "success" | "error" | "skipped";
  message?: string;
  data?: Record<string, any>;
}

export interface TaskExecutionContext {
  deliveryAttempt: number;
  isRedelivery: boolean;
  lease: TaskExecutionLease;
}

export interface TaskExecutionLease {
  readonly ownerToken: string;
  readonly expiresAt: string;
  assertOwned(): Promise<void>;
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
