import type { Context, Next } from "hono";

import type { IUser } from "~/types";
import { getLogger } from "~/utils/logger";
import { generateId } from "~/utils/id";

const logger = getLogger({ prefix: "middleware/loggerMiddleware" });

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

	const requestIdHeader = c.req.header("x-request-id");
	const requestId = requestIdHeader || generateId();
	c.set("requestId", requestId);
	if (!requestIdHeader) {
		c.res.headers.set("x-request-id", requestId);
	}

	const user = c.get("user") as IUser | undefined;
	const userId = user?.id;

	const startTime = Date.now();
	logger.info(`Request started: ${method} ${url}`, {
		method,
		url,
		userId,
	});

	try {
		await next();

		const duration = Date.now() - startTime;

		const responseContext = {
			method,
			url,
			status: c.res.status,
			duration: `${duration / 1000}s`,
			userId,
		};

		if (c.res.status >= 500) {
			logger.error(
				`Request completed with server error: ${method} ${url}`,
				responseContext,
			);
		} else if (c.res.status >= 400) {
			logger.warn(
				`Request completed with client error: ${method} ${url}`,
				responseContext,
			);
		} else if (duration > 5000) {
			logger.warn(`Slow request completed: ${method} ${url}`, responseContext);
		} else {
			logger.info(`Request completed: ${method} ${url}`, responseContext);
		}
	} catch (error) {
		const duration = Date.now() - startTime;

		const errorContext = {
			method,
			url,
			error: error instanceof Error ? error.message : String(error),
			duration: `${duration / 1000}s`,
			userId,
			userAgent,
			stack:
				error instanceof Error
					? error.stack?.substring(0, 1000)
					: "No stack trace",
		};

		logger.error(`Request failed: ${method} ${url}`, errorContext);

		throw error;
	}
};

/**
 * Creates a logger instance with a specific prefix for a route
 * @param routeName A name to identify this route in logs
 * @returns A logger instance specific to this route
 */
export const createRouteLogger = (routeName: string) => {
	return getLogger({ prefix: `routes/${routeName}` });
};
