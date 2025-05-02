import { zValidator } from "@hono/zod-validator";
import { Scalar } from "@scalar/hono-api-reference";
import { type Context, Hono } from "hono";
import { openAPISpecs } from "hono-openapi";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";

import {
  API_LOCAL_HOST,
  API_PROD_HOST,
  LOCAL_HOST,
  PROD_HOST,
} from "./constants/app";
import { authMiddleware } from "./middleware/auth";
import { loggerMiddleware } from "./middleware/loggerMiddleware";
import { rateLimit } from "./middleware/rateLimit";
import { autoRegisterDynamicApps } from "./services/dynamic-apps/auto-register-apps";
import { handleGetMetrics } from "./services/metrics/getMetrics";
import type { IEnv } from "./types";
import {
  AssistantError,
  ErrorType,
  handleAIServiceError,
} from "./utils/errors";
import { LogLevel, getLogger } from "./utils/logger";

import { ROUTES } from "./constants/app";
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

const app = new Hono<{
  Bindings: IEnv;
}>();

const origin = (origin, c) => {
  if (!origin) return "*";
  if (origin.includes(PROD_HOST)) return origin;
  if (origin.includes(LOCAL_HOST)) return origin;
  return "*";
};

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

app.use("*", loggerMiddleware);

app.use(
  csrf({
    origin,
  }),
);

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

app.notFound((c) => c.json({ status: "not found" }, 404));

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
