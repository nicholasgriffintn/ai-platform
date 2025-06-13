import type { Context, Next } from "hono";

import { trackUsageMetric } from "~/lib/monitoring";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "RATE_LIMIT" });

export async function rateLimit(context: Context, next: Next) {
  if (!context.env.FREE_RATE_LIMITER || !context.env.PRO_RATE_LIMITER) {
    throw new AssistantError(
      "Rate limiter not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const url = context.req.url;
  const pathname = new URL(url).pathname;

  const user = context.get("user");
  const userId: string = user?.id;

  const key = user?.id
    ? `authenticated-${userId}-${pathname}`
    : `unauthenticated-${userId}-${pathname}`;

  const rateLimiter = user?.id
    ? context.env.PRO_RATE_LIMITER
    : context.env.FREE_RATE_LIMITER;

  const result = await rateLimiter.limit({
    key,
  });

  if (!result.success) {
    const errorMessage = user?.id
      ? "Rate limit exceeded: 100 requests per minute"
      : "Rate limit exceeded: 10 requests per minute. Please authenticate for higher limits.";
    
    logger.warn("Rate limit exceeded", {
      userId,
      pathname,
      key,
      isAuthenticated: !!user?.id,
    });

    throw new AssistantError(
      errorMessage,
      ErrorType.RATE_LIMIT_ERROR,
    );
  }

  // Track usage metrics asynchronously to avoid blocking the request
  const name = pathname.split("/").pop();
  // Fire and forget - don't await to avoid blocking the request
  Promise.resolve().then(async () => {
    try {
      await trackUsageMetric(userId, name, context.env.ANALYTICS);
    } catch (error) {
      logger.error("Failed to track usage metric", { error, userId, name });
    }
  });

  return next();
}
