import {
  formatMcpToolResult,
  McpRequestError,
  readMcpToolUiResourceUri,
  type FormattedMcpToolResult,
  type McpTool,
  type McpToolCallResult,
} from "@ngriffin_uk/polychat-ai-integrations";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { requireToolEffects, type ToolEffectHints } from "@ngriffin_uk/polychat-library-tools";
import {
  MCP_APP_RENDERER,
  modelAcceptsImageInput,
  type McpAppView,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import {
  AssistantError,
  getErrorMessage,
  toolErrorResponse,
} from "@ngriffin_uk/polychat-utility-server/errors";

import {
  resolveServiceContext,
  type ServiceContext,
} from "~/infrastructure/context/serviceContext";
import { findModelConfig } from "~/modules/models/application/resolve";
import {
  findMcpGatewayServer,
  listMcpGatewayTools,
  openMcpGatewaySession,
  readMcpGatewayAppResource,
  readMcpGatewayServers,
  type McpGatewaySession,
} from "~/modules/tools/application/mcp-gateway-servers";
import type { IRequest, MessageContent } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";

import {
  MCP_CALL_TOOL_NAME,
  MCP_LIST_TOOLS_NAME,
  mcp_call_tool as mcp_call_toolDescriptor,
  mcp_list_tools as mcp_list_toolsDescriptor,
} from "./definitions/mcp_gateway";

const logger = getLogger({ prefix: "tools/mcp-gateway" });
const MAX_LISTED_TOOLS = 40;
const MAX_RESULT_CHARS = 16_000;
const MAX_DESCRIPTION_CHARS = 480;
const RESULT_IMAGE_OPTIONS = { maxImages: 6, maxImageBytes: 800 * 1024 };

async function activeModelReadsImages(request: IRequest): Promise<boolean> {
  const model = request.request?.model;

  if (typeof model !== "string" || !model) {
    return false;
  }

  return modelAcceptsImageInput(
    await findModelConfig(model, request.env, request.request?.provider, request.user?.id),
  );
}

function resultContent(result: FormattedMcpToolResult): string | MessageContent[] {
  const text = result.truncated ? `${result.text}\n[result truncated]` : result.text;

  if (result.images.length === 0) {
    return text;
  }

  return [
    { type: "text", text },
    ...result.images.map((image): MessageContent => ({
      type: "image_url",
      image_url: { url: `data:${image.mimeType};base64,${image.data}`, detail: "low" },
    })),
  ];
}

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

async function readToolApp(
  serviceContext: ServiceContext,
  session: McpGatewaySession,
  toolName: string,
  toolArguments: Record<string, unknown>,
  result: McpToolCallResult,
): Promise<McpAppView | null> {
  try {
    const tool = (await listMcpGatewayTools(serviceContext, session)).find(
      (candidate) => candidate.name === toolName,
    );
    const uri = tool ? readMcpToolUiResourceUri(tool) : undefined;

    if (!uri) {
      return null;
    }

    const resource = await readMcpGatewayAppResource(serviceContext, session, uri);

    if (!resource) {
      return null;
    }

    return {
      integration: session.server.label,
      tool: toolName,
      uri,
      html: resource.html,
      ui: resource.ui,
      arguments: toolArguments,
      result: {
        content: result.content,
        ...(result.structuredContent !== undefined
          ? { structuredContent: result.structuredContent }
          : {}),
        ...(result.isError !== undefined ? { isError: result.isError } : {}),
      },
    };
  } catch (error) {
    logger.warn(`The ${toolName} app could not be loaded from ${session.server.label}`, {
      error: getErrorMessage(error),
    });

    return null;
  }
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
      const tools = await listMcpGatewayTools(serviceContext, session);
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

async function readMcpToolHints(
  args: unknown,
  request: IRequest,
): Promise<ToolEffectHints | undefined> {
  const toolName = isRecord(args) && typeof args.tool === "string" ? args.tool.trim() : "";

  if (!toolName) {
    return undefined;
  }

  const serviceContext = resolveServiceContext(request);
  const server = findMcpGatewayServer(
    readMcpGatewayServers(request.request?.tool_options?.mcp_servers),
    readIntegration(args),
  );
  const session = await openMcpGatewaySession(serviceContext, server);
  const annotations = (await listMcpGatewayTools(serviceContext, session)).find(
    (tool) => tool.name === toolName,
  )?.annotations;

  if (!annotations) {
    return undefined;
  }

  return { readOnly: annotations.readOnlyHint, destructive: annotations.destructiveHint };
}

export const mcp_call_tool: ApiToolDefinition = {
  ...mcp_call_toolDescriptor,
  effects: {
    ...requireToolEffects(MCP_CALL_TOOL_NAME, mcp_call_toolDescriptor.effects),
    hints: readMcpToolHints,
  },
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

      const callResult = await session.client.callTool(toolName, toolArguments);
      const result = formatMcpToolResult(
        callResult,
        MAX_RESULT_CHARS,
        (await activeModelReadsImages(context.request)) ? RESULT_IMAGE_OPTIONS : undefined,
      );
      const app = result.isError
        ? null
        : await readToolApp(serviceContext, session, toolName, toolArguments, callResult);

      return {
        status: result.isError ? "error" : "success",
        name: MCP_CALL_TOOL_NAME,
        content: resultContent(result),
        data: {
          integration: server.label,
          tool: toolName,
          truncated: result.truncated,
          images: result.images.length,
          ...(app ? { renderer: MCP_APP_RENDERER, app } : {}),
        },
      };
    } catch (error) {
      return failure(MCP_CALL_TOOL_NAME, error);
    }
  },
};
