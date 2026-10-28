import type { AdminTaskView, AdminTasksResponse, TaskStatus } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";

const ADMIN_TASK_LIMIT = 100;
const OPEN_STATUSES: readonly TaskStatus[] = ["pending", "queued", "running", "failed"];
const VIEW_STATUSES: Record<AdminTaskView, readonly TaskStatus[]> = {
  active: ["pending", "queued", "running"],
  failed: ["failed"],
  all: ["pending", "queued", "running", "suspended", "completed", "failed", "cancelled"],
};

export async function listAdminTasks(
  context: ServiceContext,
  view: AdminTaskView,
): Promise<AdminTasksResponse> {
  const tasks = context.repositories.get(TaskRepository);
  const [counts, recent] = await Promise.all([
    tasks.countTasksByTypeAndStatus(OPEN_STATUSES),
    tasks.listRecentTasksByStatus(VIEW_STATUSES[view], ADMIN_TASK_LIMIT),
  ]);

  return {
    counts,
    tasks: recent.map(({ execution_lease_expires_at, ...task }) => ({
      ...task,
      lease_expires_at: execution_lease_expires_at,
    })),
  };
}
