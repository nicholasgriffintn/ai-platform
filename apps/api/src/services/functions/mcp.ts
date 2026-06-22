import type { ConversationManager } from "~/lib/conversationManager";
import { parseMCPToolName } from "~/services/agents/mcp-client";
import type { IFunctionResponse } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/functions/mcp" });

interface RegisteredMCPClient {
	mcpConnections: Record<string, unknown>;
	getAITools(): Record<string, unknown> | Promise<Record<string, unknown>>;
	callTool(
		toolCall: {
			name: string;
			serverId: string;
			arguments: Record<string, unknown>;
		},
		requestId: undefined,
		options: { signal: AbortSignal },
	): Record<string, unknown> | Promise<Record<string, unknown>>;
}

interface MCPToolExecutionRequest {
	request?: Record<string, unknown> & {
		functionName?: string;
	};
}

const mcpClients = new Map<string, RegisteredMCPClient>();

export const registerMCPClient = (agentId: string, client: RegisteredMCPClient): void => {
	mcpClients.set(agentId, client);
};

export const handleMCPTool = async (
	completion_id: string,
	args: unknown,
	request: MCPToolExecutionRequest,
	_app_url?: string,
	conversationManager?: ConversationManager,
): Promise<IFunctionResponse> => {
	try {
		const functionName = request.request?.functionName;
		if (!functionName) {
			throw new AssistantError("Missing function name", ErrorType.PARAMS_ERROR);
		}

		const mcpToolName = parseMCPToolName(functionName);
		if (!mcpToolName) {
			throw new AssistantError(`Invalid MCP tool format: ${functionName}`, ErrorType.PARAMS_ERROR);
		}

		const fullAgentId = Array.from(mcpClients.keys()).find((id) =>
			id.startsWith(mcpToolName.shortAgentId),
		);
		if (!fullAgentId) {
			throw new AssistantError(
				`No agent found with ID starting with ${mcpToolName.shortAgentId}`,
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

		const toolsResponse = await client.getAITools();
		if (!toolsResponse || !Object.keys(toolsResponse).length) {
			throw new AssistantError(
				`No tools available for agent ${fullAgentId}`,
				ErrorType.EXTERNAL_API_ERROR,
			);
		}

		const { toolName } = mcpToolName;

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

		return await executeTool(client, toolName, args, toolName, completion_id, conversationManager);
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
	client: RegisteredMCPClient,
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
		typeof args === "object" && args !== null ? (args as Record<string, unknown>) : {};

	try {
		const fallbackResult = await client.callTool(
			{
				name: toolName,
				serverId: connectionId,
				arguments: argsObj,
			},
			undefined,
			{ signal: new AbortController().signal },
		);
		const answer = "content" in fallbackResult ? fallbackResult.content : fallbackResult;

		if (conversationManager) {
			await conversationManager.add(completion_id, {
				role: "tool",
				content: "Request completed",
				name: originalToolName,
				status: "success",
				data: {
					answer,
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
				answer,
				name: originalToolName,
				formattedName: "MCP",
				responseType: "custom",
			},
		};
	} catch (error) {
		logger.error(`Error calling tool ${toolName}:`, {
			error_message: error instanceof Error ? error.message : "Unknown error",
		});
		throw error;
	}
}
