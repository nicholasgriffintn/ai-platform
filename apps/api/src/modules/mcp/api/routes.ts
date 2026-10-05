import {
  createNativeMcpServerSchema,
  updateNativeMcpServerSchema,
  connectNativeMcpServerSchema,
  nativeMcpServerSchema,
  nativeMcpServerListSchema,
  nativeMcpIdSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { discoverMcpServer } from "~/modules/mcp/application/discovery";
import {
  connectMcpServer,
  createMcpServer,
  deleteMcpServer,
  disconnectMcpServer,
  listMcpServers,
  updateMcpServer,
} from "~/modules/mcp/application/registry";

const app = new Hono();
const tags = ["mcp"];
const paramSchema = z.object({ serverId: nativeMcpIdSchema });
const serverResponse = { 200: { description: "MCP server", schema: nativeMcpServerSchema } };
const successResponse = {
  200: { description: "MCP operation completed", schema: z.object({ success: z.boolean() }) },
};

addRoute(app, "get", "/", {
  tags,
  auth: true,
  querySchema: z.object({ workspaceId: nativeMcpIdSchema.optional() }).strict(),
  responses: { 200: { description: "MCP catalogue", schema: nativeMcpServerListSchema } },
  handler: ({ serviceContext, query }) => listMcpServers(serviceContext, query.workspaceId),
});

addRoute(app, "post", "/", {
  tags,
  auth: true,
  bodySchema: createNativeMcpServerSchema,
  responses: serverResponse,
  handler: ({ serviceContext, body }) => createMcpServer(serviceContext, body),
});

addRoute(app, "patch", "/:serverId", {
  tags,
  auth: true,
  paramSchema,
  bodySchema: updateNativeMcpServerSchema,
  responses: serverResponse,
  handler: ({ serviceContext, params, body }) =>
    updateMcpServer(serviceContext, params.serverId, body),
});

addRoute(app, "delete", "/:serverId", {
  tags,
  auth: true,
  paramSchema,
  querySchema: z.object({ revision: z.coerce.number().int().positive() }).strict(),
  responses: successResponse,
  handler: ({ serviceContext, params, query }) =>
    deleteMcpServer(serviceContext, params.serverId, query.revision),
});

addRoute(app, "put", "/:serverId/connection", {
  tags,
  auth: true,
  paramSchema,
  bodySchema: connectNativeMcpServerSchema,
  responses: serverResponse,
  handler: ({ serviceContext, params, body }) =>
    connectMcpServer(serviceContext, params.serverId, body),
});

addRoute(app, "delete", "/:serverId/connection", {
  tags,
  auth: true,
  paramSchema,
  responses: successResponse,
  handler: ({ serviceContext, params }) => disconnectMcpServer(serviceContext, params.serverId),
});

addRoute(app, "post", "/:serverId/discover", {
  tags,
  auth: true,
  paramSchema,
  bodySchema: z.object({ revision: z.int().positive() }).strict(),
  responses: serverResponse,
  handler: ({ serviceContext, params, body }) =>
    discoverMcpServer(serviceContext, params.serverId, body.revision),
});

export default app;
