import { Scalar } from "@scalar/hono-api-reference";
import { type Context, Hono } from "hono";
import { describeRoute, openAPIRouteHandler } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { z } from "zod";

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
import { metricsParamsSchema, statusResponseSchema } from "./routes/schemas";
import search from "./routes/search";
import stripe from "./routes/stripe";
import tools from "./routes/tools";
import uploads from "./routes/uploads";
import user from "./routes/user";
import webhooks from "./routes/webhooks";
import memories from "./routes/memories";
import { autoRegisterDynamicApps } from "./services/dynamic-apps/auto-register-apps";
import { handleGetMetrics } from "./services/metrics/getMetrics";
import type { IEnv } from "./types";
import {
  AssistantError,
  ErrorType,
  handleAIServiceError,
} from "./utils/errors";
import { LogLevel, getLogger } from "./utils/logger";

const app = new Hono<{
  Bindings: IEnv;
}>();

const corsOrigin = (origin: string, c: Context) => {
  if (!origin) return "";
  const environment = c.env.ENV;
  if (environment === "production" && origin.includes(PROD_HOST)) return origin;
  if (environment === "development" && origin.includes(LOCAL_HOST))
    return origin;
  return "";
};

const csrfOrigin = (origin: string, c: Context) => {
  if (!origin) return false;
  const environment = c.env.ENV;
  if (environment === "production" && origin.includes(PROD_HOST)) return true;
  if (environment === "development" && origin.includes(LOCAL_HOST)) return true;
  return false;
};

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

app.use(
  csrf({
    origin: csrfOrigin,
  }),
);

app.use(securityHeaders());

app.use("*", loggerMiddleware);

app.use("*", authMiddleware);

app.use("*", rateLimit);

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
        description:
          "An AI assistant that combines multiple AI models alongside purpose built tools and applications.",
      },
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

    const metricsResponse = await handleGetMetrics(context, {
      limit: Number(query.limit) || 100,
      interval: query.interval || "1",
      timeframe: query.timeframe || "24",
      type: query.type,
      status: query.status,
    });

    return context.json({ metrics: metricsResponse });
  },
);

app.route(ROUTES.AUTH, auth);
app.route(ROUTES.CHAT, chat);
app.route(ROUTES.WEBHOOKS, webhooks);
app.route(ROUTES.APPS, apps);
app.route(ROUTES.MODELS, models);
app.route(ROUTES.TOOLS, tools);
app.route(ROUTES.AUDIO, audio);
app.route(ROUTES.DYNAMIC_APPS, dynamicApps);
app.route(ROUTES.SEARCH, search);
app.route(ROUTES.UPLOADS, uploads);
app.route(ROUTES.USER, user);
app.route(ROUTES.PLANS, plans);
app.route(ROUTES.STRIPE, stripe);
app.route(ROUTES.REALTIME, realtime);
app.route(ROUTES.AGENTS, agents);
app.route(ROUTES.ADMIN, admin);
app.route(ROUTES.MEMORIES, memories);

app.notFound((c) => c.json({ status: "not found" }, 404));

app.onError((err, _c) => {
  const error = AssistantError.fromError(err, ErrorType.UNKNOWN_ERROR);
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
};
