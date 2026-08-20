import { metricsParamsSchema, statusResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { Scalar } from "@scalar/hono-api-reference";
import { withSentry } from "@sentry/cloudflare";
import { type Context, Hono } from "hono";
import { openAPIRouteHandler } from "hono-openapi";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import z from "zod/v4";

import packageJson from "../package.json";
import {
  API_LOCAL_HOST,
  API_PROD_HOST,
  LOCAL_HOST,
  PROD_HOST,
  METRICS_LOCAL_HOST,
  METRICS_PROD_HOST,
} from "./constants/app";
import { serviceContextMiddleware } from "./lib/context/serviceContext";
import { ResponseFactory } from "./lib/http/ResponseFactory";
import { addRoute } from "./lib/http/routeBuilder";
import { authMiddleware } from "./middleware/auth";
import { loggerMiddleware } from "./middleware/loggerMiddleware";
import { rateLimit } from "./middleware/rateLimit";
import { securityHeaders } from "./middleware/securityHeaders";
import { apiInfoDescription } from "./openapi/content/apiDescription";
import { tagDescriptions } from "./openapi/documentation";
import { registerApiRoutes } from "./routes/register";
import { SandboxRunCoordinator } from "./services/apps/sandbox/run-coordinator/object";
import { ConversationCoordinator } from "./services/conversations/coordinator/object";
import { handleGetMetrics } from "./services/metrics/getMetrics";
import { QueueExecutor } from "./services/tasks/QueueExecutor";
import { ScheduleExecutor } from "./services/tasks/ScheduleExecutor";
import type { TaskMessage } from "./services/tasks/TaskService";
import type { IEnv } from "./types";
import { handleAIServiceError, normaliseApiError } from "./utils/errors";
import { LogLevel, getLogger } from "./utils/logger";
import { captureApiError, getSentryOptions } from "./utils/sentry";

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

  if (!host) {
    return false;
  }

  if (environment === "production") {
    return host === PROD_HOST || host === METRICS_PROD_HOST;
  }

  if (environment === "development") {
    return host === LOCAL_HOST || host === METRICS_LOCAL_HOST;
  }

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
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "x-captcha-token"],
    credentials: true,
    maxAge: 86400,
  }),
);

app.use("*", (c, next) => {
  if (c.req.path.startsWith("/webhooks")) {
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

addRoute(app, "get", "/", {
  tags: ["system"],
  middleware: [
    Scalar({
      pageTitle: "Polychat API Reference",
      theme: "saturn",
      url: "/openapi",
    }),
  ],
  handler: async ({ raw }) => raw.body(null),
});

addRoute(app, "get", "/openapi", {
  tags: ["system"],
  middleware: [
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
  ],
  handler: async ({ raw }) => raw.body(null),
});

addRoute(app, "get", "/status", {
  tags: ["system"],
  description: "Check if the API is running with optional health information",
  querySchema: z.object({
    detailed: z.enum(["true", "false"]).optional().default("false"),
  }),
  responses: {
    200: { description: "API is running", schema: statusResponseSchema },
    503: { description: "API is unhealthy", schema: statusResponseSchema },
  },
  handler: async ({ raw }) =>
    (async (c: Context) => {
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
        (check) => check.status === "healthy" || check.status === "not_configured",
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
    })(raw),
});

addRoute(app, "get", "/metrics", {
  tags: ["system"],
  description: "Get metrics from Analytics Engine",
  querySchema: metricsParamsSchema,
  responses: {
    200: { description: "Metrics retrieved successfully" },
  },
  handler: async ({ raw }) =>
    (async (context: Context) => {
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
    })(raw),
});

registerApiRoutes(app);

app.notFound((c) => c.json({ status: "not found" }, 404));

app.onError((err, _c) => {
  const error = normaliseApiError(err);

  captureApiError(error, err);

  return handleAIServiceError(error);
});

let hasLoggedStart = false;

const handler = {
  async fetch(request: Request, env: IEnv, ctx: ExecutionContext) {
    const logLevel = LogLevel[env.LOG_LEVEL?.toUpperCase()] ?? LogLevel.INFO;

    const logger = getLogger({ prefix: "api", level: logLevel });

    if (!hasLoggedStart) {
      logger.info(`Application starting (log level=${LogLevel[logLevel]})`);
      hasLoggedStart = true;
    }

    return app.fetch(request, env, ctx);
  },
  async scheduled(event: ScheduledController, env: IEnv): Promise<void> {
    await ScheduleExecutor.respondToCronSchedules(env, event);
  },
  async queue(batch: MessageBatch, env: IEnv): Promise<void> {
    await QueueExecutor.respondToCronQueue(env, {
      ...batch,
      messages: batch.messages as Message<TaskMessage>[],
    });
  },
} satisfies ExportedHandler<IEnv>;

export default withSentry<IEnv>(getSentryOptions, handler);

export { ConversationCoordinator, SandboxRunCoordinator };
