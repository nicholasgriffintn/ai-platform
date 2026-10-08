import {
  browserScopeQuerySchema,
  errorResponseSchema,
  savedToolConfigurationSchema,
  savedToolConfigurationsResponseSchema,
  modelToolIdSchema,
  runnableToolExecuteRequestSchema,
  runnableToolResponseSchema,
  runnableToolSchema,
  toolsResponseSchema,
  saveToolConfigurationSchema,
  mcpConnectionInputSchema,
  mcpConnectionSchema,
  mcpConnectionListSchema,
  mcpOAuthCallbackQuerySchema,
  mcpOAuthStartInputSchema,
  mcpOAuthStartResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { type Context, Hono } from "hono";
import z from "zod/v4";

import { getServiceContext } from "~/infrastructure/context/serviceContext";
import { addRoute } from "~/infrastructure/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { runFunctionWithOutput } from "~/modules/functions/application/run-with-output";
import {
  createMcpConnection,
  deleteMcpConnection,
  listMcpConnections,
} from "~/modules/tools/application/mcp-connections";
import {
  completeMcpOAuthConnection,
  mcpOAuthReturnUrl,
  startMcpOAuthConnection,
} from "~/modules/tools/application/mcp-oauth-connections";
import {
  listModelToolConfigurations,
  saveModelToolConfiguration,
} from "~/modules/tools/application/modelToolConfigurations";
import { getRunnableTool } from "~/modules/tools/application/runnable";
import { getScopedAvailableTools } from "~/modules/tools/application/toolsOperations";
import { projectScopeQuerySchema } from "~/modules/workspaces/application/access";
import type { IRequest } from "~/types";

const app = new Hono();

addRoute(app, "get", "/mcp/connections", {
  auth: true,
  tags: ["tools"],
  cache: "no-store",
  responses: { 200: { description: "Saved MCP connections", schema: mcpConnectionListSchema } },
  handler: ({ serviceContext }) => listMcpConnections(serviceContext),
});

addRoute(app, "post", "/mcp/connections", {
  auth: true,
  tags: ["tools"],
  cache: "no-store",
  bodySchema: mcpConnectionInputSchema,
  responses: { 200: { description: "Saved MCP connection", schema: mcpConnectionSchema } },
  handler: ({ serviceContext, body }) => createMcpConnection(serviceContext, body),
});

addRoute(app, "delete", "/mcp/connections/:connectionId", {
  auth: true,
  tags: ["tools"],
  cache: "no-store",
  paramSchema: z.object({ connectionId: z.string().min(1) }),
  responses: {
    200: { description: "Removed MCP connection", schema: z.object({ success: z.boolean() }) },
  },
  handler: ({ serviceContext, params }) => deleteMcpConnection(serviceContext, params.connectionId),
});

const routeLogger = createRouteLogger("tools");

addRoute(app, "post", "/mcp/oauth/start", {
  auth: true,
  tags: ["tools"],
  cache: "no-store",
  summary: "Start signing in to an MCP server",
  bodySchema: mcpOAuthStartInputSchema,
  responses: {
    200: { description: "Where to send the browser", schema: mcpOAuthStartResponseSchema },
  },
  handler: ({ serviceContext, body }) => startMcpOAuthConnection(serviceContext, body),
});

addRoute(app, "get", "/mcp/oauth/callback", {
  tags: ["tools"],
  cache: "no-store",
  summary: "Finish signing in to an MCP server",
  querySchema: mcpOAuthCallbackQuerySchema,
  responses: { 302: { description: "Back to Polychat" } },
  handler: ({ raw }) =>
    (async (c: Context) => {
      const query = mcpOAuthCallbackQuerySchema.parse(c.req.query());
      const serviceContext = getServiceContext(c);
      let connected = false;

      try {
        connected = (await completeMcpOAuthConnection(serviceContext, query)).connected;
      } catch (error) {
        routeLogger.warn("MCP sign-in could not be completed", { error });
      }

      return c.redirect(mcpOAuthReturnUrl(serviceContext, connected ? "connected" : "failed"));
    })(raw),
});

app.use("/*", (c, next) => {
  routeLogger.info(`Processing tools route: ${c.req.path}`);

  return next();
});

addRoute(app, "get", "/", {
  tags: ["tools"],
  summary: "List Tools",
  description: "Lists the currently available tools.",
  querySchema: browserScopeQuerySchema,
  responses: {
    200: {
      description: "List of available tools with their details",
      schema: toolsResponseSchema,
    },
    500: { description: "Server error", schema: errorResponseSchema },
  },
  handler: ({ serviceContext, query }) =>
    getScopedAvailableTools(serviceContext, query.projectId, query.workspaceId),
  cache: "no-store",
});

const toolParamsSchema = z.object({ id: z.string().min(1) });
const configurableToolParamsSchema = z.object({ id: modelToolIdSchema });

addRoute(app, "get", "/configurations", {
  auth: true,
  tags: ["tools"],
  summary: "List tool configurations",
  description: "Returns saved model-tool configuration for the authenticated scope.",
  responses: {
    200: {
      description: "Saved tool configurations",
      schema: savedToolConfigurationsResponseSchema,
    },
  },
  handler: async ({ serviceContext, user }) =>
    listModelToolConfigurations(serviceContext, { type: "user", id: user.id }),
});

addRoute(app, "put", "/:id/configuration", {
  auth: true,
  tags: ["tools"],
  summary: "Save tool configuration",
  description: "Validates and saves model-tool configuration for the authenticated scope.",
  paramSchema: configurableToolParamsSchema,
  bodySchema: saveToolConfigurationSchema,
  responses: {
    200: {
      description: "Saved tool configuration",
      schema: savedToolConfigurationSchema,
    },
    400: { description: "Invalid tool configuration", schema: errorResponseSchema },
  },
  handler: async ({ body, params, serviceContext, user }) =>
    saveModelToolConfiguration(
      serviceContext,
      { type: "user", id: user.id },
      params.id,
      body.configuration,
    ),
});

addRoute(app, "get", "/:id", {
  tags: ["tools"],
  summary: "Get a runnable tool",
  description:
    "Returns a tool with a form derived from its input schema, so it can be run from the interface instead of by a model.",
  paramSchema: toolParamsSchema,
  responses: {
    200: { description: "Runnable tool", schema: runnableToolSchema },
    404: { description: "Tool not found", schema: errorResponseSchema },
  },
  handler: async ({ params }) => {
    const tool = getRunnableTool(params.id);

    if (!tool) {
      throw new AssistantError("Tool not found", ErrorType.NOT_FOUND, 404);
    }

    return tool;
  },
});

addRoute(app, "post", "/:id/execute", {
  auth: true,
  tags: ["tools"],
  summary: "Run a tool",
  description: "Runs a tool with the submitted form values and stores the result as an output.",
  paramSchema: toolParamsSchema,
  querySchema: projectScopeQuerySchema,
  bodySchema: runnableToolExecuteRequestSchema,
  responses: {
    200: { description: "Tool result", schema: runnableToolResponseSchema },
    404: { description: "Tool not found", schema: errorResponseSchema },
  },
  handler: async ({ body, params, query, raw, serviceContext, user }) => {
    if (!getRunnableTool(params.id)) {
      throw new AssistantError("Tool not found", ErrorType.NOT_FOUND, 404);
    }

    const requestUrl = new URL(raw.req.url);
    const req: IRequest = {
      app_url: `${requestUrl.protocol}//${requestUrl.host}`,
      env: serviceContext.env,
      request: {
        completion_id: generateId(),
        input: "tool-execution",
        date: new Date().toISOString(),
        platform: "tool-run",
      },
      user,
      context: serviceContext,
    };

    return runFunctionWithOutput(params.id, body, req, query.projectId);
  },
});

export default app;
