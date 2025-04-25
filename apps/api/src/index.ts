import { zValidator } from "@hono/zod-validator";
import { Scalar } from "@scalar/hono-api-reference";
import { type Context, Hono } from "hono";
import { openAPISpecs } from "hono-openapi";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";

import { authMiddleware } from "./middleware/auth";
import { loggerMiddleware } from "./middleware/loggerMiddleware";
import { rateLimit } from "./middleware/rateLimit";
import auth from "./routes/auth";
import { metricsParamsSchema, statusResponseSchema } from "./routes/schemas";
import { handleGetMetrics } from "./services/metrics/getMetrics";
import {
  AssistantError,
  ErrorType,
  handleAIServiceError,
} from "./utils/errors";
import { LogLevel, getLogger } from "./utils/logger";

import { autoRegisterDynamicApps } from "./services/dynamic-apps/auto-register-apps";

import { ROUTES } from "./constants/app";
import apps from "./routes/apps";
import audio from "./routes/audio";
import chat from "./routes/chat";
import dynamicApps from "./routes/dynamic-apps";
import models from "./routes/models";
import search from "./routes/search";
import tools from "./routes/tools";
import uploads from "./routes/uploads";
import user from "./routes/user";
import webhooks from "./routes/webhooks";
import type { IEnv } from "./types";

const app = new Hono<{
  Bindings: IEnv;
}>();

const origin = (origin, c) => {
  if (!origin) return "*";
  if (origin.includes("polychat.app")) return origin;
  if (origin.includes("localhost")) return origin;
  return "*";
};

/**
 * Global middleware to enable CORS
 */
app.use(
  "*",
  cors({
    origin,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
      "x-turnstile-token",
    ],
    credentials: true,
    maxAge: 86400,
  }),
);

/**
 * Global middleware for logging
 */
app.use("*", loggerMiddleware);

/**
 * Global middleware to apply CSRF protection
 */
app.use(
  csrf({
    origin,
  }),
);

/**
 * Global middleware to check if the user is authenticated
 * and if they are, set the user in the context
 */
app.use("*", authMiddleware);

/**
 * Global middleware to rate limit requests
 */
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
  openAPISpecs(app, {
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
          url: "https://api.polychat.app",
          description: "production",
        },
        {
          url: "http://localhost:8787",
          description: "development",
        },
      ],
    },
  }),
);

app.get(
  "/status",
  describeRoute({
    description: "Check if the API is running",
    responses: {
      200: {
        description: "API is running",
        content: {
          "application/json": {
            schema: resolver(statusResponseSchema),
          },
        },
      },
    },
  }),
  (c) => c.json({ status: "ok" }),
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

/**
 * Routes
 */
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

/**
 * Global 404 handler
 */
app.notFound((c) => c.json({ status: "not found" }, 404));

/**
 * Global error handler
 */
app.onError((err, c) => {
  const error = AssistantError.fromError(err, ErrorType.UNKNOWN_ERROR);
  return handleAIServiceError(error);
});

let hasLoggedStart = false;

export default {
  async fetch(request: Request, env: IEnv, ctx: ExecutionContext) {
    const raw = env.LOG_LEVEL?.toUpperCase() ?? "INFO";
    const level =
      (LogLevel[raw as keyof typeof LogLevel] as LogLevel) ?? LogLevel.INFO;

    const logger = getLogger({ prefix: "API", level });
    if (!hasLoggedStart) {
      logger.info(`Application starting (log level=${LogLevel[level]})`);
      hasLoggedStart = true;
    }

    return app.fetch(request, env, ctx);
  },
};
