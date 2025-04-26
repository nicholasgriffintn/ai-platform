import type { Context, Next } from "hono";

import type { IUser } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "HTTP" });

/**
 * Middleware that logs request and response details
 * Includes timing information and customizable log level
 * @param c - The context of the request
 * @param next - The next middleware function
 * @returns The next middleware function
 */
export const loggerMiddleware = async (c: Context, next: Next) => {
  const method = c.req.method;
  const url = c.req.url;
  const userAgent = c.req.header("user-agent") || "unknown";

  const user = c.get("user") as IUser | undefined;
  const userId = user?.id || "anonymous";

  const startTime = Date.now();
  logger.info(`Request started: ${method} ${url}`, {
    method,
    url,
    userId,
  });

  try {
    await next();

    const duration = Date.now() - startTime;

    logger.info(`Request completed: ${method} ${url}`, {
      method,
      url,
      status: c.res.status,
      duration: `${duration}ms`,
      userId,
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(`Request failed: ${method} ${url}`, {
      method,
      url,
      error: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`,
      userId,
      userAgent,
      stack: error instanceof Error ? error.stack : "No stack trace",
    });

    throw error;
  }
};

/**
 * Creates a logger instance with a specific prefix for a route
 * @param routeName A name to identify this route in logs
 * @returns A logger instance specific to this route
 */
export const createRouteLogger = (routeName: string) => {
  return getLogger({ prefix: routeName });
};
