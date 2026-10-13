import {
  formatMcpToolResult,
  McpRequestError,
  type McpTool,
} from "@ngriffin_uk/polychat-ai-integrations";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  getErrorMessage,
  toolErrorResponse,
} from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import {
  findMcpGatewayServer,
  openMcpGatewaySession,
  readMcpGatewayServers,
} from "~/modules/tools/application/mcp-gateway-servers";
import type { ApiToolDefinition } from "~/types/functions";

import {
  MCP_CALL_TOOL_NAME,
  MCP_LIST_TOOLS_NAME,
  mcp_call_tool as mcp_call_toolDescriptor,
  mcp_list_tools as mcp_list_toolsDescriptor,
} from "./definitions/mcp_gateway";

const MAX_LISTED_TOOLS = 40;
const MAX_RESULT_CHARS = 16_000;
const MAX_DESCRIPTION_CHARS = 480;

function describeTool(tool: McpTool): string {
  const description = tool.description?.replace(/\s+/g, " ").trim().slice(0, MAX_DESCRIPTION_CHARS);
  const hints = [
    tool.annotations?.readOnlyHint ? "reads only" : null,
    tool.annotations?.destructiveHint ? "can delete or overwrite" : null,
  ].filter(Boolean);

  return JSON.stringify({
    name: tool.name,
    ...(description ? { description } : {}),
    ...(hints.length > 0 ? { hints } : {}),
    ...(tool.inputSchema ? { inputSchema: tool.inputSchema } : {}),
  });
}

function failure(name: string, error: unknown) {
  if (error instanceof McpRequestError) {
    return toolErrorResponse(
      name,
      `${error.message}${error.requestSent ? "" : " Nothing was sent to the integration."}`,
    );
  }

  if (error instanceof AssistantError) {
    return toolErrorResponse(name, error.message);
  }

  return toolErrorResponse(name, getErrorMessage(error, "The MCP integration failed."));
}

function readIntegration(args: unknown): string {
  return isRecord(args) && typeof args.integration === "string" ? args.integration.trim() : "";
}

export const mcp_list_tools: ApiToolDefinition = {
  ...mcp_list_toolsDescriptor,
  execute: async (args, context) => {
    try {
      const serviceContext = resolveServiceContext(context.request);
      const server = findMcpGatewayServer(
        readMcpGatewayServers(context.request.request?.tool_options?.mcp_servers),
        readIntegration(args),
      );
      const session = await openMcpGatewaySession(serviceContext, server);
      const tools = (await session.client.listTools()).filter(
        (tool) => !session.allowedTools || session.allowedTools.has(tool.name),
      );
      const shown = tools.slice(0, MAX_LISTED_TOOLS);
      const header = `${server.label} offers ${tools.length} tool${tools.length === 1 ? "" : "s"}${
        shown.length < tools.length ? ` (showing ${shown.length})` : ""
      }. Run one with ${MCP_CALL_TOOL_NAME}.`;

      return {
        status: "success",
        name: MCP_LIST_TOOLS_NAME,
        content: [header, ...shown.map(describeTool)].join("\n").slice(0, MAX_RESULT_CHARS),
        data: { integration: server.label, tools: shown.map((tool) => tool.name) },
      };
    } catch (error) {
      return failure(MCP_LIST_TOOLS_NAME, error);
    }
  },
};

export const mcp_call_tool: ApiToolDefinition = {
  ...mcp_call_toolDescriptor,
  execute: async (args, context) => {
    const toolName = isRecord(args) && typeof args.tool === "string" ? args.tool.trim() : "";
    const toolArguments = isRecord(args) && isRecord(args.arguments) ? args.arguments : {};

    try {
      const serviceContext = resolveServiceContext(context.request);
      const server = findMcpGatewayServer(
        readMcpGatewayServers(context.request.request?.tool_options?.mcp_servers),
        readIntegration(args),
      );
      const session = await openMcpGatewaySession(serviceContext, server);

      if (!toolName || (session.allowedTools && !session.allowedTools.has(toolName))) {
        return toolErrorResponse(
          MCP_CALL_TOOL_NAME,
          `${server.label} does not allow "${toolName}" in this conversation. Nothing was sent to the integration.`,
        );
      }

      const result = formatMcpToolResult(
        await session.client.callTool(toolName, toolArguments),
        MAX_RESULT_CHARS,
      );

      return {
        status: result.isError ? "error" : "success",
        name: MCP_CALL_TOOL_NAME,
        content: result.truncated ? `${result.text}\n[result truncated]` : result.text,
        data: { integration: server.label, tool: toolName, truncated: result.truncated },
      };
    } catch (error) {
      return failure(MCP_CALL_TOOL_NAME, error);
    }
  },
};
