import {
  createWebhookEndpointSchema,
  listQuerySchema,
  updateWebhookEndpointSchema,
  webhookEndpointListSchema,
  webhookEndpointParamsSchema,
  webhookEndpointSchema,
  webhookEndpointWithSecretSchema,
  webhookTestResultSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineResource } from "~/infrastructure/http/resource";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  getWebhookEndpoint,
  listWebhookEndpoints,
  rotateWebhookEndpointSecret,
  testWebhookEndpoint,
  updateWebhookEndpoint,
} from "~/modules/webhook-endpoints/application/endpoints";

const app = new Hono();

defineResource(app, { idParam: "webhook_endpoint_id", tags: ["webhooks"] }, (endpoints) => {
  endpoints
    .list({
      auth: true,
      summary: "List webhook endpoints",
      querySchema: listQuerySchema,
      responses: { 200: { description: "Endpoints", schema: webhookEndpointListSchema } },
      handler: ({ serviceContext, query }) => listWebhookEndpoints(serviceContext, query),
    })
    .create({
      auth: true,
      summary: "Register a webhook endpoint",
      description:
        "Polychat POSTs signed platform events to the URL. The signing secret is returned once.",
      bodySchema: createWebhookEndpointSchema,
      responses: {
        200: {
          description: "The endpoint and its secret",
          schema: webhookEndpointWithSecretSchema,
        },
      },
      handler: ({ serviceContext, body }) => createWebhookEndpoint(serviceContext, body),
    })
    .read({
      auth: true,
      summary: "Read a webhook endpoint",
      paramSchema: webhookEndpointParamsSchema,
      responses: { 200: { description: "The endpoint", schema: webhookEndpointSchema } },
      handler: ({ serviceContext, params }) =>
        getWebhookEndpoint(serviceContext, params.webhook_endpoint_id),
    })
    .update({
      auth: true,
      summary: "Update a webhook endpoint",
      paramSchema: webhookEndpointParamsSchema,
      bodySchema: updateWebhookEndpointSchema,
      responses: { 200: { description: "The endpoint", schema: webhookEndpointSchema } },
      handler: ({ serviceContext, params, body }) =>
        updateWebhookEndpoint(serviceContext, params.webhook_endpoint_id, body),
    })
    .delete({
      auth: true,
      summary: "Delete a webhook endpoint",
      paramSchema: webhookEndpointParamsSchema,
      handler: async ({ serviceContext, params }) => {
        await deleteWebhookEndpoint(serviceContext, params.webhook_endpoint_id);

        return { deleted: true };
      },
    })
    .action("rotate", {
      auth: true,
      summary: "Rotate a webhook endpoint's signing secret",
      description: "The old secret stops working immediately. The new one is returned once.",
      paramSchema: webhookEndpointParamsSchema,
      responses: {
        200: {
          description: "The endpoint and its secret",
          schema: webhookEndpointWithSecretSchema,
        },
      },
      handler: ({ serviceContext, params }) =>
        rotateWebhookEndpointSecret(serviceContext, params.webhook_endpoint_id),
    })
    .action("test", {
      auth: true,
      summary: "Send a test event to a webhook endpoint",
      paramSchema: webhookEndpointParamsSchema,
      responses: { 200: { description: "Delivery outcome", schema: webhookTestResultSchema } },
      handler: ({ serviceContext, params }) =>
        testWebhookEndpoint(serviceContext, params.webhook_endpoint_id),
    });
});

export default app;
