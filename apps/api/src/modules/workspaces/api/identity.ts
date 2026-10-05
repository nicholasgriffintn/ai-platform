import {
  createOidcConnectionSchema,
  updateOidcConnectionSchema,
  oidcConnectionResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  getWorkspaceOidcConnection,
  createWorkspaceOidcConnection,
  updateWorkspaceOidcConnection,
  deleteWorkspaceOidcConnection,
} from "~/modules/auth/application/enterprise/configuration";

const app = new Hono();
const paramSchema = z.object({ workspaceId: z.string().min(1) });

addRoute(app, "get", "/:workspaceId/identity", {
  auth: true,
  tags: ["workspaces", "identity"],
  paramSchema,
  summary: "Read the workspace identity connection",
  responses: { 200: { description: "Identity connection", schema: oidcConnectionResponseSchema } },
  handler: ({ serviceContext, params }) =>
    getWorkspaceOidcConnection(serviceContext, params.workspaceId),
});

addRoute(app, "post", "/:workspaceId/identity", {
  auth: true,
  tags: ["workspaces", "identity"],
  paramSchema,
  bodySchema: createOidcConnectionSchema,
  summary: "Configure the workspace identity connection",
  responses: { 200: { description: "Identity connection", schema: oidcConnectionResponseSchema } },
  handler: ({ serviceContext, params, body }) =>
    createWorkspaceOidcConnection(serviceContext, params.workspaceId, body),
});

addRoute(app, "patch", "/:workspaceId/identity", {
  auth: true,
  tags: ["workspaces", "identity"],
  paramSchema,
  bodySchema: updateOidcConnectionSchema,
  summary: "Update the workspace identity connection",
  responses: { 200: { description: "Identity connection", schema: oidcConnectionResponseSchema } },
  handler: ({ serviceContext, params, body }) =>
    updateWorkspaceOidcConnection(serviceContext, params.workspaceId, body),
});

addRoute(app, "delete", "/:workspaceId/identity", {
  auth: true,
  tags: ["workspaces", "identity"],
  paramSchema,
  summary: "Disconnect workspace identity and revoke managed membership",
  responses: { 200: { description: "Disconnected", schema: z.object({ success: z.boolean() }) } },
  handler: ({ serviceContext, params }) =>
    deleteWorkspaceOidcConnection(serviceContext, params.workspaceId),
});

export default app;
