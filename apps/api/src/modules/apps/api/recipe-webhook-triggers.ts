import {
  errorResponseSchema,
  recipeWebhookTriggerCreateRequestSchema,
  recipeWebhookTriggerSchema,
  recipeWebhookTriggerSecretSchema,
  recipeWebhookTriggersResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { ResponseFactory } from "~/infrastructure/http/ResponseFactory";
import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  createRecipeWebhookTrigger,
  deleteRecipeWebhookTrigger,
  listRecipeWebhookTriggers,
  rotateRecipeWebhookTrigger,
  setRecipeWebhookTriggerStatus,
} from "~/modules/recipes/application/webhook-triggers";

const app = new Hono();
const installationParamsSchema = z.object({ installationId: z.string().min(1) });
const triggerParamsSchema = z.object({ triggerId: z.string().min(1) });
const triggerStatusSchema = z.object({ status: z.enum(["active", "paused"]) });

addRoute(app, "get", "/installations/:installationId/webhook-triggers", {
  auth: true,
  tags: ["apps"],
  paramSchema: installationParamsSchema,
  responses: {
    200: { description: "Webhook triggers", schema: recipeWebhookTriggersResponseSchema },
    404: { description: "Recipe installation not found", schema: errorResponseSchema },
  },
  handler: ({ params, serviceContext, user }) =>
    listRecipeWebhookTriggers({
      context: serviceContext,
      userId: user.id,
      installationId: params.installationId,
    }),
});

addRoute(app, "post", "/installations/:installationId/webhook-triggers", {
  auth: true,
  tags: ["apps"],
  paramSchema: installationParamsSchema,
  bodySchema: recipeWebhookTriggerCreateRequestSchema,
  responses: {
    200: {
      description: "Created webhook trigger with its URL, shown once",
      schema: recipeWebhookTriggerSecretSchema,
    },
    404: { description: "Recipe installation not found", schema: errorResponseSchema },
  },
  handler: ({ params, body, serviceContext, user }) =>
    createRecipeWebhookTrigger({
      context: serviceContext,
      userId: user.id,
      installationId: params.installationId,
      input: body,
    }),
});

addRoute(app, "put", "/webhook-triggers/:triggerId", {
  auth: true,
  tags: ["apps"],
  paramSchema: triggerParamsSchema,
  bodySchema: triggerStatusSchema,
  responses: {
    200: { description: "Updated webhook trigger", schema: recipeWebhookTriggerSchema },
    404: { description: "Webhook trigger not found", schema: errorResponseSchema },
  },
  handler: async ({ raw, params, body, serviceContext, user }) => {
    const trigger = await setRecipeWebhookTriggerStatus({
      context: serviceContext,
      userId: user.id,
      triggerId: params.triggerId,
      status: body.status,
    });

    return trigger ?? ResponseFactory.error(raw, "Webhook trigger not found", 404);
  },
});

addRoute(app, "post", "/webhook-triggers/:triggerId/rotate", {
  auth: true,
  tags: ["apps"],
  paramSchema: triggerParamsSchema,
  responses: {
    200: {
      description: "Webhook trigger with a new URL, shown once",
      schema: recipeWebhookTriggerSecretSchema,
    },
    404: { description: "Webhook trigger not found", schema: errorResponseSchema },
  },
  handler: async ({ raw, params, serviceContext, user }) => {
    const trigger = await rotateRecipeWebhookTrigger({
      context: serviceContext,
      userId: user.id,
      triggerId: params.triggerId,
    });

    return trigger ?? ResponseFactory.error(raw, "Webhook trigger not found", 404);
  },
});

addRoute(app, "delete", "/webhook-triggers/:triggerId", {
  auth: true,
  tags: ["apps"],
  paramSchema: triggerParamsSchema,
  responses: {
    204: { description: "Webhook trigger deleted" },
    404: { description: "Webhook trigger not found", schema: errorResponseSchema },
  },
  handler: async ({ raw, params, serviceContext, user }) => {
    const deleted = await deleteRecipeWebhookTrigger({
      context: serviceContext,
      userId: user.id,
      triggerId: params.triggerId,
    });

    return deleted
      ? ResponseFactory.noContent(raw)
      : ResponseFactory.error(raw, "Webhook trigger not found", 404);
  },
});

export default app;
