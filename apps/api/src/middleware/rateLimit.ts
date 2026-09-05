import type { Context, Next } from "hono";

import { trackUsageMetric } from "~/lib/monitoring";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "middleware/rateLimit" });

export async function rateLimit(context: Context, next: Next) {
  if (!context.env.FREE_RATE_LIMITER || !context.env.PRO_RATE_LIMITER) {
    throw new AssistantError("Rate limiter not configured", ErrorType.CONFIGURATION_ERROR);
  }

  const pathname = context.req.path;

  if (pathname === "/status" || pathname === "/openapi") {
    return next();
  }

  if (context.get("servicePrincipal")) {
    return next();
  }

  const user = context.get("user");
  const anonymousUser = context.get("anonymousUser");
  const userId: string = user?.id;
  const anonymousUserId: string = anonymousUser?.id;
  const clientAddress = context.req.header?.("CF-Connecting-IP") ?? "unknown";

  const key = userId
    ? `authenticated-${userId}`
    : anonymousUserId
      ? `unauthenticated-${anonymousUserId}`
      : `unauthenticated-${clientAddress}`;

  const rateLimiter = userId ? context.env.PRO_RATE_LIMITER : context.env.FREE_RATE_LIMITER;

  const result = await rateLimiter.limit({
    key,
  });

  if (!result.success) {
    const errorMessage = userId
      ? "Rate limit exceeded: 100 requests per minute"
      : "Rate limit exceeded: 10 requests per minute. Please authenticate for higher limits.";

    logger.warn("Rate limit exceeded", {
      userId,
      pathname,
      key,
      isAuthenticated: !!userId,
    });

    throw new AssistantError(errorMessage, ErrorType.RATE_LIMIT_ERROR);
  }

  const routeName = pathname.split("/").pop() || "unknown";

  trackUsageMetric(userId || anonymousUserId, routeName, context.env.ANALYTICS);

  return next();
}
