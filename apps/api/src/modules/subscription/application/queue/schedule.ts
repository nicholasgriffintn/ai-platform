import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { overageSyncHourIso } from "~/modules/subscription/application/stripeOverageSync";
import type { IEnv } from "~/types";

const logger = getLogger({ prefix: "modules/subscription/schedule" });

export async function scheduleStripeUsageSync(env: IEnv, now = new Date()): Promise<void> {
  try {
    const taskService = new TaskService(env, new TaskRepository(env));
    const hourIso = overageSyncHourIso(now);
    const hourKey = hourIso.slice(0, 13).replace(/[-T]/g, "");

    await taskService.enqueueTask({
      id: `stripe_usage_sync_${hourKey}`,
      task_type: "stripe_usage_sync",
      task_data: { hourIso },
      priority: 6,
      metadata: { hourIso },
    });

    logger.info("Stripe usage sync task scheduled", { hourIso });
  } catch (error) {
    logger.error("Failed to schedule Stripe usage sync:", error);
    throw error;
  }
}
