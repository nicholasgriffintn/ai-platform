import type { Context, Next } from "hono";

import { emitInfraUsage } from "~/lib/usage/infraUsage";
import {
  createRequestInfraMeter,
  drainRequestInfraMeter,
  runWithRequestInfraMeter,
} from "~/lib/usage/requestMeter";
import type { IEnv, IUser } from "~/types";
import { getLogger } from "~/utils/logger";

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
      const emission = emitInfraUsage({
        env,
        userId: user.id,
        scopeKey: requestId,
        quantities,
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
