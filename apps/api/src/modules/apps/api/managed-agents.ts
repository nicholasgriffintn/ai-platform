import {
  createManagedAgentSessionSchema,
  NO_STORE,
  managedAgentAcceptedSchema,
  managedAgentDeletedSchema,
  managedAgentItemsSchema,
  managedAgentListQuerySchema,
  managedAgentMessageSchema,
  managedAgentPageQuerySchema,
  managedAgentParamsSchema,
  managedAgentSessionResponseSchema,
  managedAgentSessionsResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  cancelManagedAgentTurn,
  createManagedAgentSession,
  deleteManagedAgentSession,
  listManagedAgentItems,
  listManagedAgentSessions,
  retrieveManagedAgentSession,
  streamManagedAgentEvents,
  submitManagedAgentMessage,
} from "~/modules/apps/application/managed-agents/sessions";
import { projectScopeQuerySchema } from "~/modules/workspaces/application/access";

const app = new Hono();

app.use("/*", async (context, next) => {
  context.header("Cache-Control", NO_STORE);
  await next();
});

addRoute(app, "post", "/sessions", {
  auth: true,
  tags: ["apps"],
  summary: "Create a Bedrock Managed Agents session",
  description:
    "Creates a session using personal Bedrock credentials or workspace AWS credentials. Project creation requires an owner or admin.",
  querySchema: projectScopeQuerySchema,
  bodySchema: createManagedAgentSessionSchema,
  responses: {
    200: { description: "Managed agent session", schema: managedAgentSessionResponseSchema },
  },
  handler: async ({ serviceContext, body, query }) =>
    createManagedAgentSession(serviceContext, body, query.projectId),
});

addRoute(app, "get", "/sessions", {
  auth: true,
  tags: ["apps"],
  summary: "List Polychat-owned managed agent sessions",
  querySchema: managedAgentListQuerySchema,
  responses: {
    200: { description: "Managed agent sessions", schema: managedAgentSessionsResponseSchema },
  },
  handler: async ({ serviceContext, query }) => listManagedAgentSessions(serviceContext, query),
});

addRoute(app, "get", "/sessions/:id", {
  auth: true,
  tags: ["apps"],
  summary: "Refresh a managed agent session",
  paramSchema: managedAgentParamsSchema,
  responses: {
    200: { description: "Managed agent session", schema: managedAgentSessionResponseSchema },
  },
  handler: async ({ serviceContext, params }) =>
    retrieveManagedAgentSession(serviceContext, params.id),
});

addRoute(app, "post", "/sessions/:id/messages", {
  auth: true,
  tags: ["apps"],
  summary: "Submit a managed agent message",
  paramSchema: managedAgentParamsSchema,
  bodySchema: managedAgentMessageSchema,
  responses: { 200: { description: "Message accepted", schema: managedAgentAcceptedSchema } },
  handler: async ({ serviceContext, params, body }) =>
    submitManagedAgentMessage(serviceContext, params.id, body),
});

addRoute(app, "post", "/sessions/:id/cancel", {
  auth: true,
  tags: ["apps"],
  summary: "Request managed agent turn cancellation",
  paramSchema: managedAgentParamsSchema,
  responses: { 200: { description: "Cancellation requested", schema: managedAgentAcceptedSchema } },
  handler: async ({ serviceContext, params }) => cancelManagedAgentTurn(serviceContext, params.id),
});

addRoute(app, "get", "/sessions/:id/events", {
  auth: true,
  tags: ["apps"],
  summary: "Stream managed agent progress",
  paramSchema: managedAgentParamsSchema,
  responses: { 200: { description: "Bedrock session events as SSE" } },
  handler: async ({ serviceContext, params, raw }) =>
    streamManagedAgentEvents(serviceContext, params.id, raw.req.raw.signal),
});

addRoute(app, "get", "/sessions/:id/items", {
  auth: true,
  tags: ["apps"],
  summary: "Read managed agent durable output",
  paramSchema: managedAgentParamsSchema,
  querySchema: managedAgentPageQuerySchema,
  responses: { 200: { description: "Paginated output items", schema: managedAgentItemsSchema } },
  handler: async ({ serviceContext, params, query, raw }) =>
    listManagedAgentItems(serviceContext, params.id, query, raw.req.raw.signal),
});

addRoute(app, "delete", "/sessions/:id", {
  auth: true,
  tags: ["apps"],
  summary: "Delete a Polychat-owned managed agent session",
  paramSchema: managedAgentParamsSchema,
  responses: { 200: { description: "Session deleted", schema: managedAgentDeletedSchema } },
  handler: async ({ serviceContext, params }) =>
    deleteManagedAgentSession(serviceContext, params.id),
});

export default app;
