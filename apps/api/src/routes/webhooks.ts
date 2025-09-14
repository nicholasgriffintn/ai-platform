import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";

import { webhookAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { handleReplicateWebhook } from "~/services/webhooks/replicate";
import type { IBody, IEnv } from "~/types";
import { errorResponseSchema } from "./schemas/shared";
import {
  replicateWebhookJsonSchema,
  replicateWebhookQuerySchema,
  webhookResponseSchema,
} from "./schemas/webhooks";

const app = new Hono();

const routeLogger = createRouteLogger("WEBHOOKS");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing webhooks route: ${c.req.path}`);
  return next();
});

app.use("/*", webhookAuth);

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
        schema: { type: "string" },
        description: "The ID of the completion to update",
      },
    ],
    requestBody: {
      description: "Webhook data from Replicate",
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
              output: { type: "object", additionalProperties: true },
              error: { type: "string" },
              logs: { type: "string" },
              metrics: {
                type: "object",
                additionalProperties: true,
              },
            },
            required: ["id", "status"],
          },
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
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
      401: {
        description: "Unauthorized - invalid webhook secret",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
      404: {
        description: "Completion not found",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
        },
      },
      500: {
        description: "Server error",
        content: {
          "application/json": { schema: resolver(errorResponseSchema) },
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
