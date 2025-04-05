import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { webhookAuth } from "../middleware/auth";
import { createRouteLogger } from "../middleware/loggerMiddleware";
import { handleReplicateWebhook } from "../services/webhooks/replicate";
import type { IBody, IEnv } from "../types";
import {
  replicateWebhookJsonSchema,
  replicateWebhookQuerySchema,
} from "./schemas/webhooks";

const app = new Hono();

const routeLogger = createRouteLogger("WEBHOOKS");

/**
 * Global middleware to add route-specific logging
 */
app.use("/*", (c, next) => {
  routeLogger.info(`Processing webhooks route: ${c.req.path}`);
  return next();
});

/**
 * Global middleware to check the WEBHOOK_SECRET
 */
app.use("/*", webhookAuth);

const webhookResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  message: z.string(),
});

const errorResponseSchema = z.object({
  error: z.string(),
  type: z.string(),
});

app.post(
  "/replicate",
  describeRoute({
    tags: ["webhooks"],
    summary: "Handle Replicate webhook",
    description:
      "Process webhook callbacks from Replicate for asynchronous model runs",
    parameters: [
      {
        name: "completion_id",
        in: "query",
        required: true,
        schema: z.string(),
        description: "The ID of the completion to update",
      },
    ],
    requestBody: {
      description: "Webhook data from Replicate",
      required: true,
      content: {
        "application/json": {
          schema: resolver(replicateWebhookJsonSchema),
        },
      },
    },
    responses: {
      200: {
        description: "Webhook processed successfully",
        content: {
          "application/json": {
            schema: resolver(webhookResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      401: {
        description: "Unauthorized - invalid webhook secret",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "Completion not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      500: {
        description: "Server error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("query", replicateWebhookQuerySchema),
  zValidator("json", replicateWebhookJsonSchema),
  async (context: Context) => {
    const { completion_id } = context.req.valid("query" as never) as {
      completion_id: string;
    };

    const body = context.req.valid("json" as never) as IBody;

    const data = await handleReplicateWebhook(
      {
        env: context.env as IEnv,
        request: body,
      },
      completion_id,
    );

    return context.json(data);
  },
);

export default app;
