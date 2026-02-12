import { Scalar } from "@scalar/hono-api-reference";
import { type Context, Hono } from "hono";
import { describeRoute, openAPIRouteHandler } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import z from "zod/v4";

import packageJson from "../package.json";
import {
	API_LOCAL_HOST,
	API_PROD_HOST,
	LOCAL_HOST,
	PROD_HOST,
	ROUTES,
} from "./constants/app";
import { authMiddleware } from "./middleware/auth";
import { loggerMiddleware } from "./middleware/loggerMiddleware";
import { rateLimit } from "./middleware/rateLimit";
import { securityHeaders } from "./middleware/securityHeaders";
import admin from "./routes/admin";
import agents from "./routes/agents";
import apps from "./routes/apps";
import audio from "./routes/audio";
import auth from "./routes/auth";
import chat from "./routes/chat";
import dynamicApps from "./routes/dynamic-apps";
import models from "./routes/models";
import plans from "./routes/plans";
import realtime from "./routes/realtime";
import { metricsParamsSchema, statusResponseSchema } from "@assistant/schemas";
import stripe from "./routes/stripe";
import tasks from "./routes/tasks";
import tools from "./routes/tools";
import uploads from "./routes/uploads";
import user from "./routes/user";
import memories from "./routes/memories";
import sandbox from "./routes/sandbox";
import webhook from "./routes/webhooks";
import { serviceContextMiddleware } from "./lib/context/serviceContext";
import { ResponseFactory } from "./lib/http/ResponseFactory";
import { autoRegisterDynamicApps } from "./services/dynamic-apps/auto-register-apps";
import { handleGetMetrics } from "./services/metrics/getMetrics";
import type { IEnv } from "./types";
import {
	AssistantError,
	ErrorType,
	handleAIServiceError,
} from "./utils/errors";
import { LogLevel, getLogger } from "./utils/logger";
import { tagDescriptions } from "./openapi/documentation";
import { apiInfoDescription } from "./openapi/content/apiDescription";
import { TaskMessage } from "./services/tasks/TaskService";
import { ScheduleExecutor } from "./services/tasks/ScheduleExecutor";
import { QueueExecutor } from "./services/tasks/QueueExecutor";

const app = new Hono<{
	Bindings: IEnv;
}>();

const getOriginHost = (origin: string) => {
	try {
		return new URL(origin).host;
	} catch {
		return "";
	}
};

const isAllowedOrigin = (origin: string, environment: string) => {
	const host = getOriginHost(origin);
	if (!host) return false;
	if (environment === "production") return host === PROD_HOST;
	if (environment === "development") return host === LOCAL_HOST;
	return false;
};

const corsOrigin = (origin: string, c: Context) =>
	origin && isAllowedOrigin(origin, c.env.ENV) ? origin : "";

const csrfOrigin = (origin: string, c: Context) =>
	Boolean(origin && isAllowedOrigin(origin, c.env.ENV));

const csrfMiddleware = csrf({
	origin: csrfOrigin,
});

app.use(
	"*",
	cors({
		origin: corsOrigin,
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: [
			"Content-Type",
			"Authorization",
			"X-CSRF-Token",
			"x-captcha-token",
		],
		credentials: true,
		maxAge: 86400,
	}),
);

app.use("*", (c, next) => {
	if (c.req.path.startsWith(ROUTES.WEBHOOKS)) {
		return next();
	}

	return csrfMiddleware(c, next);
});

app.use(securityHeaders());

app.use("*", loggerMiddleware);

app.use("/status", async (_c, next) => next());
app.use("/openapi", async (_c, next) => next());

app.use("*", authMiddleware);

app.use("*", rateLimit);

app.use("*", serviceContextMiddleware);

autoRegisterDynamicApps();

app.get(
	"/",
	Scalar({
		pageTitle: "Polychat API Reference",
		theme: "saturn",
		url: "/openapi",
	}),
);

app.get(
	"/openapi",
	openAPIRouteHandler(app, {
		documentation: {
			info: {
				title: "Polychat API",
				version: "0.0.1",
				description: apiInfoDescription,
			},
			tags: Object.entries(tagDescriptions).map(([name, description]) => ({
				name,
				description,
			})),
			components: {
				securitySchemes: {
					bearerAuth: {
						type: "http",
						scheme: "bearer",
						bearerFormat: "JWT",
					},
				},
			},
			security: [
				{
					bearerAuth: [],
				},
			],
			servers: [
				{
					url: `https://${API_PROD_HOST}`,
					description: "production",
				},
				{
					url: `http://${API_LOCAL_HOST}`,
					description: "development",
				},
			],
		},
	}),
);

app.get(
	"/status",
	describeRoute({
		tags: ["system"],
		description: "Check if the API is running with optional health information",
		responses: {
			200: {
				description: "API is running",
				content: {
					"application/json": {
						schema: resolver(statusResponseSchema),
					},
				},
			},
			503: {
				description: "API is unhealthy",
				content: {
					"application/json": {
						schema: resolver(statusResponseSchema),
					},
				},
			},
		},
	}),
	zValidator(
		"query",
		z.object({
			detailed: z.enum(["true", "false"]).optional().default("false"),
		}),
	),
	async (c) => {
		const query = c.req.query();

		if (query.detailed !== "true") {
			const response = {
				status: "ok",
				timestamp: new Date().toISOString(),
				version: packageJson.version,
				environment: c.env.ENV || "unknown",
			};

			return c.json(response);
		}

		const startTime = Date.now();
		const healthChecks: Record<
			string,
			{ status: string; responseTime?: number; error?: string }
		> = {};

		if (c.env.DB) {
			try {
				const dbStart = Date.now();
				await c.env.DB.prepare("SELECT 1").first();
				healthChecks.database = {
					status: "healthy",
					responseTime: Date.now() - dbStart,
				};
			} catch (error) {
				healthChecks.database = {
					status: "unhealthy",
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		} else {
			healthChecks.database = {
				status: "not_configured",
			};
		}

		try {
			if (c.env.CACHE) {
				const cacheStart = Date.now();
				await c.env.CACHE.get("health-check");
				healthChecks.cache = {
					status: "healthy",
					responseTime: Date.now() - cacheStart,
				};
			} else {
				healthChecks.cache = {
					status: "not_configured",
				};
			}
		} catch (error) {
			healthChecks.cache = {
				status: "unhealthy",
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}

		if (c.env.FREE_RATE_LIMITER && c.env.PRO_RATE_LIMITER) {
			healthChecks.rateLimiter = {
				status: "configured",
			};
		} else {
			healthChecks.rateLimiter = {
				status: "not_configured",
			};
		}

		const totalResponseTime = Date.now() - startTime;
		const allHealthy = Object.values(healthChecks).every(
			(check) =>
				check.status === "healthy" || check.status === "not_configured",
		);

		const response = {
			status: allHealthy ? "ok" : "degraded",
			timestamp: new Date().toISOString(),
			version: packageJson.version,
			responseTime: totalResponseTime,
			checks: healthChecks,
			environment: c.env.ENV || "unknown",
		};

		return c.json(response, allHealthy ? 200 : 503);
	},
);

app.get(
	"/metrics",
	describeRoute({
		tags: ["system"],
		description: "Get metrics from Analytics Engine",
		responses: {
			200: {
				description: "Metrics retrieved successfully",
				content: {
					"application/json": {},
				},
			},
		},
	}),
	zValidator("query", metricsParamsSchema),
	async (context: Context) => {
		const query = context.req.query();

		const boundedLimit = Math.min(Number(query.limit) || 100, 500);
		const boundedInterval = Math.min(Number(query.interval) || 1, 60);
		const boundedTimeframe = Math.min(Number(query.timeframe) || 24, 72);

		const metricsResponse = await handleGetMetrics(context, {
			limit: boundedLimit,
			interval: boundedInterval.toString(),
			timeframe: boundedTimeframe.toString(),
			type: query.type,
			status: query.status,
		});

		return ResponseFactory.success(context, { metrics: metricsResponse });
	},
);

app.route(ROUTES.AUTH, auth);
app.route(ROUTES.CHAT, chat);
app.route(ROUTES.APPS, apps);
app.route(ROUTES.MODELS, models);
app.route(ROUTES.TASKS, tasks);
app.route(ROUTES.TOOLS, tools);
app.route(ROUTES.AUDIO, audio);
app.route(ROUTES.DYNAMIC_APPS, dynamicApps);
app.route(ROUTES.UPLOADS, uploads);
app.route(ROUTES.USER, user);
app.route(ROUTES.PLANS, plans);
app.route(ROUTES.STRIPE, stripe);
app.route(ROUTES.REALTIME, realtime);
app.route(ROUTES.AGENTS, agents);
app.route(ROUTES.ADMIN, admin);
app.route(ROUTES.MEMORIES, memories);
app.route(ROUTES.SANDBOX, sandbox);
app.route(ROUTES.WEBHOOKS, webhook);

app.notFound((c) => c.json({ status: "not found" }, 404));

app.onError((err, _c) => {
	const error =
		err instanceof AssistantError
			? err
			: AssistantError.fromError(err, ErrorType.UNKNOWN_ERROR);
	return handleAIServiceError(error);
});

let hasLoggedStart = false;

export default {
	async fetch(request: Request, env: IEnv, ctx: ExecutionContext) {
		const logLevel = LogLevel[env.LOG_LEVEL?.toUpperCase()] ?? LogLevel.INFO;

		const logger = getLogger({ prefix: "api", level: logLevel });

		if (!hasLoggedStart) {
			logger.info(`Application starting (log level=${LogLevel[logLevel]})`);
			hasLoggedStart = true;
		}

		return app.fetch(request, env, ctx);
	},
	async scheduled(event: ScheduledEvent, env: IEnv): Promise<void> {
		await ScheduleExecutor.respondToCronSchedules(env, event);
	},
	async queue(batch: MessageBatch<TaskMessage>, env: IEnv): Promise<void> {
		await QueueExecutor.respondToCronQueue(env, batch);
	},
};
