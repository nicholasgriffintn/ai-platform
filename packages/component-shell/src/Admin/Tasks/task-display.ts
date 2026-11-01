import type {
  AdminTaskTypeSummary,
  AdminTaskView,
  AdminTaskWorkflow,
  TaskExecutionStatus,
  TaskStatus,
} from "@ngriffin_uk/polychat-schemas";

export type BadgeTone = "info" | "warning" | "success" | "failure" | "muted";

export const TASK_VIEW_OPTIONS = [
  { id: "active", label: "Running and waiting" },
  { id: "failed", label: "Failed" },
  { id: "all", label: "Everything recent" },
] as const satisfies readonly { id: AdminTaskView; label: string }[];

export const TASK_STATUS_TONE: Record<TaskStatus, BadgeTone> = {
  pending: "muted",
  queued: "muted",
  running: "info",
  suspended: "warning",
  completed: "success",
  failed: "failure",
  cancelled: "muted",
};

export const STEP_STATUS_TONE: Record<TaskExecutionStatus, BadgeTone> = {
  running: "info",
  completed: "success",
  failed: "failure",
};

export const WORKFLOW_STATUS_TONE: Record<AdminTaskWorkflow["status"], BadgeTone> = {
  queued: "muted",
  running: "info",
  waiting: "info",
  paused: "warning",
  waitingForPause: "warning",
  rollingBack: "warning",
  errored: "failure",
  terminated: "muted",
  complete: "success",
  unknown: "muted",
  unavailable: "muted",
};

export const WORKFLOW_STATUS_LABEL: Record<AdminTaskWorkflow["status"], string> = {
  queued: "Waiting for a slot",
  running: "Running",
  waiting: "Sleeping until its next step",
  paused: "Paused",
  waitingForPause: "Pausing",
  rollingBack: "Rolling back",
  errored: "Errored",
  terminated: "Stopped",
  complete: "Complete",
  unknown: "Unknown",
  unavailable: "Run record no longer kept",
};

export const OPEN_TASK_STATUSES = new Set<TaskStatus>([
  "pending",
  "queued",
  "running",
  "suspended",
]);

export const RETRYABLE_TASK_STATUSES = new Set<TaskStatus>(["failed", "cancelled"]);

export interface TaskTotals {
  running: number;
  waiting: number;
  scheduled: number;
  suspended: number;
  failed: number;
  completed: number;
}

export function sumTaskTypes(types: readonly AdminTaskTypeSummary[]): TaskTotals {
  return types.reduce<TaskTotals>(
    (totals, type) => ({
      running: totals.running + type.running,
      waiting: totals.waiting + type.waiting,
      scheduled: totals.scheduled + type.scheduled,
      suspended: totals.suspended + type.suspended,
      failed: totals.failed + type.failed,
      completed: totals.completed + type.completed,
    }),
    { running: 0, waiting: 0, scheduled: 0, suspended: 0, failed: 0, completed: 0 },
  );
}
