import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  DELEGATION_WAKE_TASK_TYPE,
  TEAMMATE_CONTEXT_CLEANUP_TASK_TYPE,
  TEAMMATE_RUN_RECONCILIATION_TASK_TYPE,
  SOURCE_KNOWLEDGE_INDEX_TASK_TYPE,
  SOURCE_KNOWLEDGE_SYNC_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import type { IEnv } from "~/types";

import { TaskService } from "./TaskService";

const logger = getLogger({ prefix: "services/tasks/scheduled" });

const SETTLED_TASK_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const SETTLED_TASK_PURGE_LIMIT = 500;
const DELIVERY_RECOVERY_DELAY_MS = 5 * 60 * 1000;
const MAX_DURABLE_TASK_RECOVERIES = 3;
const DURABLE_TASK_TYPES = [
  SOURCE_KNOWLEDGE_INDEX_TASK_TYPE,
  SOURCE_KNOWLEDGE_SYNC_TASK_TYPE,
  DELEGATION_WAKE_TASK_TYPE,
  TEAMMATE_RUN_RECONCILIATION_TASK_TYPE,
  TEAMMATE_CONTEXT_CLEANUP_TASK_TYPE,
] as const;

export async function recoverFailedDurableTasks(env: IEnv, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - DELIVERY_RECOVERY_DELAY_MS);
  const recovered = (
    await Promise.all(
      DURABLE_TASK_TYPES.map((taskType) =>
        new TaskRepository(env).requeueFailedTasksByType(
          taskType,
          cutoff,
          MAX_DURABLE_TASK_RECOVERIES,
        ),
      ),
    )
  ).flat();

  if (recovered.length > 0) {
    logger.info("Recovered failed durable tasks", { recovered: recovered.length });
  }

  return recovered.length;
}

export async function redispatchPendingTasks(env: IEnv, now = new Date()): Promise<number> {
  const taskService = new TaskService(env, new TaskRepository(env));
  const dispatched = await taskService.dispatchPendingTasks(
    new Date(now.getTime() - DELIVERY_RECOVERY_DELAY_MS),
  );

  if (dispatched > 0) {
    logger.info("Recovered pending task queue deliveries", { dispatched });
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
