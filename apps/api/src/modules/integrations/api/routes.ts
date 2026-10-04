import {
  createIntegrationSchema,
  integrationConnectionSchema,
  integrationIdSchema,
  integrationListResponseSchema,
  integrationRefreshSchema,
  integrationResponseSchema,
  integrationReviewResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";

import { requireIntegrationDefinition } from "../application/access";
import { listNativeIntegrations } from "../application/catalogue";
import { disconnectIntegrationConnection } from "../application/connections";
import {
  connectNativeIntegrationAccount,
  createNativeIntegrationDefinition,
  publishNativeIntegrationRevision,
  reviewNativeIntegrationDefinition,
} from "../application/definitions";
import { revokeNativeIntegrationDefinition } from "../application/revoke-definition";

const app = new Hono();
const integrationParams = z.object({ id: integrationIdSchema });

addRoute(app, "get", "/", {
  auth: true,
  tags: ["integrations"],
  summary: "List scoped custom MCP integrations",
  querySchema: z.object({
    workspaceId: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
  }),
  responses: { 200: { description: "Custom integrations", schema: integrationListResponseSchema } },
  handler: ({ serviceContext, query }) => listNativeIntegrations(serviceContext, query),
});

addRoute(app, "delete", "/:id/connection", {
  auth: true,
  tags: ["integrations"],
  summary: "Disconnect the current person's integration account",
  paramSchema: integrationParams,
  responses: { 200: { description: "Account disconnected" } },
  handler: async ({ serviceContext, params, user }) => {
    await requireIntegrationDefinition(serviceContext, params.id);
    await disconnectIntegrationConnection(serviceContext, user.id, params.id);

    return { success: true };
  },
});

addRoute(app, "post", "/", {
  auth: true,
  tags: ["integrations"],
  summary: "Create a reviewed custom MCP definition with a personal account",
  bodySchema: createIntegrationSchema,
  responses: { 200: { description: "Integration created", schema: integrationResponseSchema } },
  handler: ({ serviceContext, body }) => createNativeIntegrationDefinition(serviceContext, body),
});

addRoute(app, "put", "/:id/connection", {
  auth: true,
  tags: ["integrations"],
  summary: "Connect or rotate the current person's integration account",
  paramSchema: integrationParams,
  bodySchema: integrationConnectionSchema,
  responses: { 200: { description: "Account connected", schema: integrationResponseSchema } },
  handler: ({ serviceContext, params, body }) =>
    connectNativeIntegrationAccount(serviceContext, params.id, body.token),
});

addRoute(app, "post", "/:id/review", {
  auth: true,
  tags: ["integrations"],
  summary: "Preview current service schemas before saving a new revision",
  paramSchema: integrationParams,
  responses: { 200: { description: "Service review", schema: integrationReviewResponseSchema } },
  handler: ({ serviceContext, params }) =>
    reviewNativeIntegrationDefinition(serviceContext, params.id),
});

addRoute(app, "post", "/:id/revisions", {
  auth: true,
  tags: ["integrations"],
  summary: "Publish the exact reviewed service revision",
  paramSchema: integrationParams,
  bodySchema: integrationRefreshSchema,
  responses: { 200: { description: "Revision published", schema: integrationResponseSchema } },
  handler: ({ serviceContext, params, body }) =>
    publishNativeIntegrationRevision(serviceContext, params.id, body),
});

addRoute(app, "delete", "/:id", {
  auth: true,
  tags: ["integrations"],
  summary: "Revoke a custom integration definition and remove its credentials",
  paramSchema: integrationParams,
  responses: { 200: { description: "Integration definition revoked" } },
  handler: ({ serviceContext, params }) =>
    revokeNativeIntegrationDefinition(serviceContext, params.id),
});

export default app;
