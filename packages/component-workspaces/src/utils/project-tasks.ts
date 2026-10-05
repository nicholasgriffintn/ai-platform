import type { ProjectTask, ProjectTaskStatus } from "@ngriffin_uk/polychat-schemas";
import { sortCopy } from "@ngriffin_uk/polychat-utility-core";

const STATUS_ORDER: Record<ProjectTaskStatus, number> = {
  blocked: 0,
  review: 1,
  running: 2,
  queued: 3,
  backlog: 4,
  done: 5,
  cancelled: 6,
};

export function sortProjectTasks(tasks: readonly ProjectTask[]): ProjectTask[] {
  return sortCopy(
    tasks,
    (left, right) =>
      (left.blockedReason === "awaiting_timer" ? 3 : STATUS_ORDER[left.status]) -
        (right.blockedReason === "awaiting_timer" ? 3 : STATUS_ORDER[right.status]) ||
      new Date(right.updatedAt ?? right.createdAt).getTime() -
        new Date(left.updatedAt ?? left.createdAt).getTime(),
  );
}
