import {
  INFRA_RECONCILIATION_TASK_TYPE,
  REALTIME_RECONCILIATION_TASK_TYPE,
  STRIPE_USAGE_SYNC_TASK_TYPE,
  USAGE_ROLLUP_TASK_TYPE,
  type Task,
} from "@ngriffin_uk/polychat-schemas";

const ACCOUNTING_TASK_TYPES = new Set<string>([
  INFRA_RECONCILIATION_TASK_TYPE,
  REALTIME_RECONCILIATION_TASK_TYPE,
  STRIPE_USAGE_SYNC_TASK_TYPE,
  USAGE_ROLLUP_TASK_TYPE,
]);

export function isAccountVisibleTask(task: Pick<Task, "task_type">): boolean {
  return !ACCOUNTING_TASK_TYPES.has(task.task_type);
}
