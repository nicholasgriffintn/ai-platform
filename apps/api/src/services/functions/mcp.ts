import type { MCPClientManager } from "agents/mcp/client";
import { z } from "zod";

import type { ConversationManager } from "~/lib/conversationManager";
import type { IFunctionResponse, IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "MCP_FUNCTIONS" });

const mcpClients = new Map<string, MCPClientManager>();

export const registerMCPClient = (
  agentId: string,
  client: MCPClientManager,
): void => {
  mcpClients.set(agentId, client);
};

export const handleMCPTool = async (
  completion_id: string,
  args: unknown,
  request: IRequest,
  app_url?: string,
  conversationManager?: ConversationManager,
): Promise<IFunctionResponse> => {
  try {
    const functionName = request.request?.functionName;
    if (!functionName) {
      throw new AssistantError("Missing function name", ErrorType.PARAMS_ERROR);
    }

    const parts = functionName.split("_");
    if (parts.length < 3 || parts[0] !== "mcp") {
      throw new AssistantError(
        `Invalid MCP tool format: ${functionName}`,
        ErrorType.PARAMS_ERROR,
      );
    }

    const shortAgentId = parts[1];

    const fullAgentId = Array.from(mcpClients.keys()).find((id) =>
      id.startsWith(shortAgentId),
    );
    if (!fullAgentId) {
      throw new AssistantError(
        `No agent found with ID starting with ${shortAgentId}`,
        ErrorType.PARAMS_ERROR,
      );
    }

    const client = mcpClients.get(fullAgentId);
    if (!client) {
      throw new AssistantError(
        `MCP client not found for agent ${fullAgentId}`,
        ErrorType.PARAMS_ERROR,
      );
    }

    const toolsResponse = await client.unstable_getAITools();
    if (!toolsResponse || !Object.keys(toolsResponse).length) {
      throw new AssistantError(
        `No tools available for agent ${fullAgentId}`,
        ErrorType.EXTERNAL_API_ERROR,
      );
    }

    const toolName = parts.slice(2).join("_");

    if (!toolsResponse[toolName]) {
      throw new AssistantError(
        `Tool "${toolName}" not found. Available tools: ${Object.keys(toolsResponse).join(", ")}`,
        ErrorType.PARAMS_ERROR,
      );
    }

    const availableConnections = Object.keys(client.mcpConnections);
    const connectionId = availableConnections.find((id) =>
      toolName.startsWith(id),
    );

    if (!connectionId) {
      throw new AssistantError(
        `Could not determine connection ID from tool name: ${toolName}`,
        ErrorType.PARAMS_ERROR,
      );
    }

    const argsObj =
      typeof args === "object" && args !== null
        ? (args as Record<string, unknown>)
        : {};

    const baseFunctionName = toolName.substring(toolName.indexOf("_") + 1);

    const fallbackResult = await client.callTool(
      {
        name: baseFunctionName,
        serverId: connectionId,
        arguments: argsObj,
      },
      z.any() as any,
      { signal: new AbortController().signal },
    );

    return {
      content: "",
      data: fallbackResult.content,
      status: "success",
    };
  } catch (error) {
    logger.error("Error in MCP tool execution:", error);
    throw new AssistantError(
      `MCP tool execution failed: ${(error as Error).message}`,
      ErrorType.EXTERNAL_API_ERROR,
    );
  }
};
