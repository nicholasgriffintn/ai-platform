import { STRIPE_USAGE_SYNC_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import { SCHEDULES } from "~/config/schedules";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";

import { scheduleStripeUsageSync } from "./schedule";
import { StripeUsageSyncHandler } from "./StripeUsageSyncHandler";

export function registerSubscriptionQueue(workflows: AppWorkflows): void {
  workflows.register(STRIPE_USAGE_SYNC_TASK_TYPE, new StripeUsageSyncHandler());

  workflows.every(
    SCHEDULES.RECIPE_EXECUTION,
    defineSchedule({
      name: "stripe-usage-sync",
      run: async ({ env, invokedAt }) => {
        if (invokedAt.getUTCMinutes() === 0) {
          await scheduleStripeUsageSync(env, invokedAt);
        }
      },
    }),
  );
}
