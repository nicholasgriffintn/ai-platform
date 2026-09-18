import type {
  TaskEnqueueRequest as WorkflowTaskEnqueueRequest,
  TaskHandler as WorkflowTaskHandler,
  TaskMessage as WorkflowTaskMessage,
} from "@ngriffin_uk/polychat-ai-workflows";
import type { TaskType } from "@ngriffin_uk/polychat-schemas";

import type { IEnv } from "~/types";

export type {
  TaskExecutionContext,
  TaskExecutionLease,
  TaskResult,
} from "@ngriffin_uk/polychat-ai-workflows";

export type TaskHandler = WorkflowTaskHandler<IEnv, TaskType>;
export type TaskMessage = WorkflowTaskMessage<TaskType>;
export type TaskDefinition = WorkflowTaskEnqueueRequest<TaskType>;
