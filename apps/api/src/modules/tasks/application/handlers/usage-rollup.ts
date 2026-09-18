import { applyUsageRollup, type UsageEventRecord } from "@ngriffin_uk/polychat-ai-billing";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { z } from "zod/v4";

import { createUsageRuntime } from "~/modules/usage/application/runtime";

import { defineTask } from "../workflows";

export const usageRollup = defineTask({
  payload: z.object({ events: z.array(z.custom<UsageEventRecord>(isRecord)) }),
  handle: async ({ events }, { env }) => {
    if (events.length === 0) {
      return { status: "skipped", message: "No usage events to roll up" };
    }

    const { inserted } = await applyUsageRollup(createUsageRuntime({ env }), events);

    return {
      status: "success",
      message: `Rolled up ${inserted} of ${events.length} usage events`,
      data: { inserted, received: events.length },
    };
  },
});
