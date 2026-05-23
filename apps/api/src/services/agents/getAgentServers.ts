import type { MCPClientManager } from "agents/mcp/client";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { connectMCPServerReady, type MCPServerConfig } from "~/services/agents/mcp-client";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { safeParseJson } from "../../utils/json";

const logger = getLogger({ prefix: "services/agents/servers" });

export async function getAgentServers(context: ServiceContext, agentId: string, userId?: number) {
	context.ensureDatabase();
	const agent = await getValidatedAgent(context, agentId, userId);

	if (!agent.servers) {
		return [];
	}

	let serverConfigs: MCPServerConfig[] = [];
	const serversJson = agent.servers as string;
	serverConfigs = safeParseJson(serversJson) as MCPServerConfig[];
	if (!serverConfigs) {
		throw new AssistantError("Invalid servers configuration", ErrorType.PARAMS_ERROR);
	}

	if (!serverConfigs || serverConfigs.length === 0) {
		return [];
	}

	if (!context.env.MCP_STORAGE) {
		throw new AssistantError("MCP storage not configured", ErrorType.CONFIGURATION_ERROR);
	}

	const { MCPClientManager } = await import("agents/mcp/client");
	const mcp: MCPClientManager = new MCPClientManager(agent.id, "1.0.0", {
		storage: context.env.MCP_STORAGE,
	});

	const serverDetails = await Promise.all(
		serverConfigs.map(async (server) => {
			try {
				const readyConnection = await connectMCPServerReady(mcp, server);
				if ("error" in readyConnection) {
					logger.error("MCP connection failed", {
						server_id: readyConnection.id,
						server_url: server.url,
						error_message: readyConnection.error,
					});
					return {
						id: readyConnection.id,
						connectionState: "error",
						error: readyConnection.error,
					};
				}
				const { id, connection } = readyConnection;

				const tools = connection.tools;
				const prompts = connection.prompts;
				const resources = connection.resources;

				return {
					id,
					connectionState: connection.connectionState,
					tools,
					prompts,
					resources,
				};
			} catch (error) {
				logger.error("Error connecting to MCP server", {
					server_url: server.url,
					error_message: error instanceof Error ? error.message : "Unknown error",
				});
				return {
					id: server.url,
					connectionState: "error",
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}
		}),
	);

	return serverDetails;
}

async function getValidatedAgent(context: ServiceContext, agentId: string, userId?: number) {
	const id = userId ?? context.requireUser().id;
	const agent = await context.repositories.agents.getAgentById(agentId);

	if (!agent) {
		throw new AssistantError("Agent not found", ErrorType.NOT_FOUND);
	}

	if (agent.user_id !== id) {
		throw new AssistantError("Forbidden", ErrorType.AUTHENTICATION_ERROR);
	}

	return agent;
}
