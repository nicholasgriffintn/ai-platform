import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import type { IEnv } from "~/types";

import { TaskService } from "./TaskService";

const logger = getLogger({ prefix: "services/tasks/scheduled" });

const SETTLED_TASK_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const SETTLED_TASK_PURGE_LIMIT = 500;
const DISPATCH_RECOVERY_DELAY_MS = 5 * 60 * 1000;

export async function redispatchPendingTasks(env: IEnv, now = new Date()): Promise<number> {
  const taskService = new TaskService(env, new TaskRepository(env));
  const dispatched = await taskService.dispatchPendingTasks(
    new Date(now.getTime() - DISPATCH_RECOVERY_DELAY_MS),
  );

  if (dispatched > 0) {
    logger.info("Started runs for pending tasks", { dispatched });
  }

  return dispatched;
}

export async function purgeSettledTasks(env: IEnv, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SETTLED_TASK_RETENTION_MS);
  const deleted = await new TaskRepository(env).deleteSettledTasksBefore(
    cutoff,
    SETTLED_TASK_PURGE_LIMIT,
  );

  if (deleted > 0) {
    logger.info("Purged settled tasks", { deleted, cutoff: cutoff.toISOString() });
  }

  return deleted;
}
