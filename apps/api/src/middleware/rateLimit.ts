import type { Context, Next } from "hono";

import { trackUsageMetric } from "../lib/monitoring";
import { AssistantError, ErrorType } from "../utils/errors";

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
  const userEmail: string = user?.email || "anonymous@undefined.computer";

  const key = user?.id
    ? `authenticated-${userEmail}-${pathname}`
    : `unauthenticated-${userEmail}-${pathname}`;

  const rateLimiter = user?.id
    ? context.env.PRO_RATE_LIMITER
    : context.env.FREE_RATE_LIMITER;

  const result = await rateLimiter.limit({
    key,
  });

  if (!result.success) {
    throw new AssistantError(
      user?.id
        ? "Rate limit exceeded: 100 requests per minute"
        : "Rate limit exceeded: 10 requests per minute. Please authenticate for higher limits.",
      ErrorType.RATE_LIMIT_ERROR,
    );
  }

  const name = pathname.split("/").pop();

  trackUsageMetric(user?.id || "anonymous", name, context.env.ANALYTICS);

  return next();
}
