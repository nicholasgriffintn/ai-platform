import {
  emitInfraUsage,
  createRequestInfraMeter,
  drainRequestInfraMeter,
  runWithRequestInfraMeter,
} from "@ngriffin_uk/polychat-ai-billing";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { Context, Next } from "hono";

import { createUsageRuntime } from "~/services/usage/runtime";
import type { IEnv, IUser } from "~/types";

const logger = getLogger({ prefix: "middleware/infraMetering" });

export const infraMeteringMiddleware = async (c: Context, next: Next) => {
  const meter = createRequestInfraMeter();

  try {
    await runWithRequestInfraMeter(meter, () => next());
  } finally {
    const user = c.get("user") as IUser | undefined;
    const requestId = c.get("requestId") as string | undefined;
    const env = c.env as IEnv;
    const quantities = drainRequestInfraMeter(meter);

    if (user?.id && requestId && env?.DB && quantities.length > 0) {
      const emission = emitInfraUsage(createUsageRuntime({ env }), {
        userId: user.id,
        scopeKey: requestId,
        quantities,
        delivery: "inline",
      }).catch((error) => {
        logger.warn("Failed to emit per-request infrastructure usage", { error, requestId });
      });

      try {
        c.executionCtx.waitUntil(emission);
      } catch {
        await emission;
      }
    }
  }
};
