import Stripe from "stripe";

import { runStripeOverageSync } from "~/lib/billing/stripeOverageSync";
import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";

const logger = getLogger({ prefix: "services/tasks/stripe-usage-sync" });

export class StripeUsageSyncHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    if (!env.STRIPE_SECRET_KEY) {
      return { status: "skipped", message: "Stripe is not configured" };
    }

    const payload = message.task_data as { hourIso?: string } | undefined;
    const parsedHour = payload?.hourIso ? Date.parse(payload.hourIso) : Number.NaN;
    const syncTime = Number.isFinite(parsedHour) ? new Date(parsedHour) : new Date();

    try {
      const result = await runStripeOverageSync(
        new RepositoryManager(env),
        new Stripe(env.STRIPE_SECRET_KEY),
        syncTime,
      );

      return {
        status: "success",
        message: `Sent ${result.sent} overage meter events for ${result.candidates} candidates`,
        data: { ...result },
      };
    } catch (error) {
      logger.error("Stripe overage sync failed", { error, taskId: message.taskId });

      return { status: "error", message: (error as Error).message };
    }
  }
}
