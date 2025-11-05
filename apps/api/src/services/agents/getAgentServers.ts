import { MCPClientManager } from "agents/mcp/client";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { safeParseJson } from "../../utils/json";

const logger = getLogger({ prefix: "services/agents/servers" });

export async function getAgentServers(
	context: ServiceContext,
	agentId: string,
	userId?: number,
) {
	context.ensureDatabase();
	const agent = await getValidatedAgent(context, agentId, userId);

	if (!agent.servers) {
		return [];
	}

	let serverConfigs: Array<{ url: string; type: "sse" }> = [];
	const serversJson = agent.servers as string;
	serverConfigs = safeParseJson(serversJson) as Array<{
		url: string;
		type: "sse";
	}>;
	if (!serverConfigs) {
		throw new AssistantError(
			"Invalid servers configuration",
			ErrorType.PARAMS_ERROR,
		);
	}

	if (!serverConfigs || serverConfigs.length === 0) {
		return [];
	}

	const mcp = new MCPClientManager(agent.id, "1.0.0");

	const serverDetails = await Promise.all(
		serverConfigs.map(async (server) => {
			try {
				const { id } = await mcp.connect(server.url);

				const connection = mcp.mcpConnections[id];
				while (connection.connectionState !== "ready") {
					await new Promise((resolve) => setTimeout(resolve, 50));
				}

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
					error_message:
						error instanceof Error ? error.message : "Unknown error",
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

async function getValidatedAgent(
	context: ServiceContext,
	agentId: string,
	userId?: number,
) {
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
