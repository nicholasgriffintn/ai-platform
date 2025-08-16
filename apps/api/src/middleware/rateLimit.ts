import type { Context, Next } from "hono";

import { trackUsageMetric } from "~/lib/monitoring";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "RATE_LIMIT" });

// Cache for rate limit results to reduce duplicate checks
const rateLimitCache = new Map<string, { success: boolean; resetTime: number }>();
const CACHE_TTL = 60000; // 1 minute

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

  // More efficient key generation with user type distinction
  const keyPrefix = user?.id ? "auth" : "anon";
  const key = `${keyPrefix}:${userId || "anon"}:${pathname}`;

  // Check cache first to avoid unnecessary rate limiter calls
  const cached = rateLimitCache.get(key);
  if (cached && Date.now() < cached.resetTime) {
    if (!cached.success) {
      const errorMessage = user?.id
        ? "Rate limit exceeded: 100 requests per minute"
        : "Rate limit exceeded: 10 requests per minute. Please authenticate for higher limits.";

      throw new AssistantError(errorMessage, ErrorType.RATE_LIMIT_ERROR);
    }
    return next();
  }

  const rateLimiter = user?.id
    ? context.env.PRO_RATE_LIMITER
    : context.env.FREE_RATE_LIMITER;

  const result = await rateLimiter.limit({
    key,
  });

  // Cache the result for a short period
  rateLimitCache.set(key, {
    success: result.success,
    resetTime: Date.now() + CACHE_TTL,
  });

  // Clean up old cache entries periodically
  if (rateLimitCache.size > 1000) {
    const now = Date.now();
    for (const [cacheKey, value] of rateLimitCache.entries()) {
      if (now >= value.resetTime) {
        rateLimitCache.delete(cacheKey);
      }
    }
  }

  if (!result.success) {
    const errorMessage = user?.id
      ? "Rate limit exceeded: 100 requests per minute"
      : "Rate limit exceeded: 10 requests per minute. Please authenticate for higher limits.";

    logger.warn("Rate limit exceeded", {
      userId,
      pathname,
      key,
      isAuthenticated: !!user?.id,
      remaining: result.remaining,
      resetTime: result.resetTime,
    });

    throw new AssistantError(errorMessage, ErrorType.RATE_LIMIT_ERROR);
  }

  // Async tracking to avoid blocking the request
  const routeName = pathname.split("/").pop() || "unknown";
  context.executionCtx.waitUntil(
    trackUsageMetric(userId, routeName, context.env.ANALYTICS).catch(error => {
      logger.error("Failed to track usage metric", { error, userId, routeName });
    })
  );

  return next();
}
