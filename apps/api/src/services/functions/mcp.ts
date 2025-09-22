import type { MCPClientManager } from "agents/mcp/client";
import { z } from "zod/v4";

import type { ConversationManager } from "~/lib/conversationManager";
import type { IFunctionResponse, IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/functions/mcp" });

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
  _app_url?: string,
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
      const matchingTools = Object.keys(toolsResponse).filter(
        (t) => toolName.includes(t) || t.includes(toolName),
      );

      if (matchingTools.length === 1) {
        const actualToolName = matchingTools[0];
        return await executeTool(
          client,
          actualToolName,
          args,
          toolName,
          completion_id,
          conversationManager,
        );
      }

      throw new AssistantError(
        `Tool "${toolName}" not found. Available tools: ${Object.keys(toolsResponse).join(", ")}`,
        ErrorType.PARAMS_ERROR,
      );
    }

    return await executeTool(
      client,
      toolName,
      args,
      toolName,
      completion_id,
      conversationManager,
    );
  } catch (error) {
    logger.error("Error in MCP tool execution:", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
    throw new AssistantError(
      `MCP tool execution failed: ${(error as Error).message}`,
      ErrorType.EXTERNAL_API_ERROR,
    );
  }
};

async function executeTool(
  client: MCPClientManager,
  toolName: string,
  args: unknown,
  originalToolName: string,
  completion_id: string,
  conversationManager?: ConversationManager,
): Promise<IFunctionResponse> {
  const availableConnections = Object.keys(client.mcpConnections);

  let connectionId: string | undefined;

  connectionId = availableConnections.find((id) => toolName.startsWith(id));

  if (!connectionId && availableConnections.length > 0) {
    connectionId = availableConnections[0];
    logger.info(
      `No direct connection match found, using first available connection: ${connectionId}`,
    );
  }

  if (!connectionId) {
    throw new AssistantError(
      `Could not determine connection ID for tool: ${toolName}`,
      ErrorType.PARAMS_ERROR,
    );
  }

  const argsObj =
    typeof args === "object" && args !== null
      ? (args as Record<string, unknown>)
      : {};

  const baseFunctionName = toolName.includes("_")
    ? toolName.substring(toolName.indexOf("_") + 1)
    : toolName;

  try {
    const fallbackResult = await client.callTool(
      {
        name: baseFunctionName,
        serverId: connectionId,
        arguments: argsObj,
      },
      z.any() as any,
      { signal: new AbortController().signal },
    );

    if (conversationManager) {
      await conversationManager.add(completion_id, {
        role: "tool",
        content: "Request completed",
        name: originalToolName,
        status: "success",
        data: {
          answer: fallbackResult.content,
          name: originalToolName,
          formattedName: "MCP",
          responseType: "custom",
        },
        timestamp: Date.now(),
        platform: "api",
      });
    }

    return {
      status: "success",
      name: originalToolName,
      content: "Request completed",
      data: {
        answer: fallbackResult.content,
        name: originalToolName,
        formattedName: "MCP",
        responseType: "custom",
      },
    };
  } catch (error) {
    logger.error(`Error calling tool ${baseFunctionName}:`, {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
