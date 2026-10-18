import {
  browserScopeQuerySchema,
  listPageOf,
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
  mcpAppCallToolResultSchema,
  mcpAppToolCallRequestSchema,
  mcpOAuthCallbackQuerySchema,
  mcpOAuthStartInputSchema,
  mcpOAuthStartResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { addRoute } from "~/infrastructure/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { runFunctionWithOutput } from "~/modules/outputs/application/run-with-output";
import { callMcpAppTool } from "~/modules/tools/application/mcp-app-calls";
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
const routeLogger = createRouteLogger("tools");
const toolParamsSchema = z.object({ tool_id: z.string().min(1) });
const configurableToolParamsSchema = z.object({ tool_id: modelToolIdSchema });
const connectionParamsSchema = z.object({ connection_id: z.string().min(1) });

defineResource(app, { idParam: "tool_id", tags: ["tools"] }, (tools) => {
  tools
    .list({
      auth: "user-or-anonymous",
      cache: "no-store",
      summary: "List tools",
      description: "The tools available in the caller's scope, or a project's or workspace's.",
      querySchema: browserScopeQuerySchema,
      responses: { 200: { description: "Tools", schema: toolsResponseSchema } },
      handler: async ({ serviceContext, query }) =>
        listPageOf(
          await getScopedAvailableTools(serviceContext, query.project_id, query.workspace_id),
          (tool) => tool.id,
        ),
    })
    .read({
      auth: "user-or-anonymous",
      summary: "Get a runnable tool",
      description:
        "Returns a tool with a form derived from its input schema, so it can be run from the interface instead of by a model.",
      paramSchema: toolParamsSchema,
      responses: { 200: { description: "Runnable tool", schema: runnableToolSchema } },
      handler: async ({ params }) => {
        const tool = getRunnableTool(params.tool_id);

        if (!tool) {
          throw new AssistantError("Tool not found", ErrorType.NOT_FOUND, 404);
        }

        return tool;
      },
    })
    .action("execute", {
      auth: true,
      summary: "Run a tool",
      description: "Runs a tool with the submitted form values and stores the result as an output.",
      paramSchema: toolParamsSchema,
      querySchema: projectScopeQuerySchema,
      bodySchema: runnableToolExecuteRequestSchema,
      responses: { 200: { description: "Tool result", schema: runnableToolResponseSchema } },
      handler: async ({ body, params, query, raw, serviceContext, user }) => {
        if (!getRunnableTool(params.tool_id)) {
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

        return runFunctionWithOutput(params.tool_id, body, req, query.project_id);
      },
    });

  tools.singleton("configuration").update({
    auth: true,
    summary: "Save a tool's configuration",
    description: "Validates and saves model-tool configuration for the caller.",
    paramSchema: configurableToolParamsSchema,
    bodySchema: saveToolConfigurationSchema,
    responses: { 200: { description: "The configuration", schema: savedToolConfigurationSchema } },
    handler: ({ body, params, serviceContext, user }) =>
      saveModelToolConfiguration(
        serviceContext,
        { type: "user", id: user.id },
        params.tool_id,
        body.configuration,
      ),
  });

  tools.collection("configurations", "configuration_id").list({
    auth: true,
    summary: "List tool configurations",
    description: "Saved model-tool configuration for the caller.",
    responses: {
      200: { description: "Configurations", schema: savedToolConfigurationsResponseSchema },
    },
    handler: ({ serviceContext, user }) =>
      listModelToolConfigurations(serviceContext, { type: "user", id: user.id }),
  });

  tools
    .collection("mcp_connections", "connection_id")
    .list({
      auth: true,
      cache: "no-store",
      summary: "List MCP connections",
      responses: { 200: { description: "Connections", schema: mcpConnectionListSchema } },
      handler: ({ serviceContext }) => listMcpConnections(serviceContext),
    })
    .create({
      auth: true,
      cache: "no-store",
      summary: "Connect an MCP server",
      bodySchema: mcpConnectionInputSchema,
      responses: { 200: { description: "The connection", schema: mcpConnectionSchema } },
      handler: ({ serviceContext, body }) => createMcpConnection(serviceContext, body),
    })
    .delete({
      auth: true,
      cache: "no-store",
      summary: "Remove an MCP connection",
      paramSchema: connectionParamsSchema,
      handler: ({ serviceContext, params }) =>
        deleteMcpConnection(serviceContext, params.connection_id),
    })
    .collectionAction("authorise", {
      auth: true,
      cache: "no-store",
      summary: "Start signing in to an MCP server",
      bodySchema: mcpOAuthStartInputSchema,
      responses: {
        200: { description: "Where to send the browser", schema: mcpOAuthStartResponseSchema },
      },
      handler: ({ serviceContext, body }) => startMcpOAuthConnection(serviceContext, body),
    })
    .view("callback", {
      auth: false,
      cache: "no-store",
      summary: "Finish signing in to an MCP server",
      description: "The OAuth redirect target. Sends the browser back to Polychat.",
      querySchema: mcpOAuthCallbackQuerySchema,
      responses: { 302: { description: "Back to Polychat" } },
      handler: async ({ query, raw, serviceContext }) => {
        let connected = false;

        try {
          connected = (await completeMcpOAuthConnection(serviceContext, query)).connected;
        } catch (error) {
          routeLogger.warn("MCP sign-in could not be completed", { error });
        }

        return raw.redirect(mcpOAuthReturnUrl(serviceContext, connected ? "connected" : "failed"));
      },
    });
});

addRoute(app, "post", "/mcp/calls", {
  tags: ["tools"],
  summary: "Run a read-only MCP tool from an app view",
  description:
    "Lets an MCP app rendered in a conversation refresh its data. Only tools the integration marks read-only run here; anything that changes something has to go through the conversation so it can ask first.",
  auth: true,
  bodySchema: mcpAppToolCallRequestSchema,
  responses: { 200: { description: "The tool result", schema: mcpAppCallToolResultSchema } },
  handler: ({ serviceContext, body }) => callMcpAppTool(serviceContext, body),
});

export default app;
