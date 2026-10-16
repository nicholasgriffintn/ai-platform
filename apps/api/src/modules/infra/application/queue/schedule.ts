import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { INFRA_RECONCILIATION_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import { previousUtcDay } from "~/modules/infra/application/reconciliation";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "modules/infra/schedule" });

export async function scheduleInfraReconciliation(env: IEnv, now = new Date()): Promise<void> {
  try {
    const taskService = new TaskService(env, new TaskRepository(env));
    const day = previousUtcDay(now);

    await taskService.enqueueTask({
      id: `infra_reconciliation_${day}`,
      task_type: INFRA_RECONCILIATION_TASK_TYPE,
      task_data: { day },
      priority: 6,
    });

    logger.info("Infra reconciliation task scheduled", { day });
  } catch (error) {
    logger.error("Failed to schedule infra reconciliation:", error);
  }
}
