import { MCPClientManager } from "agents/mcp/client";

import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/agents/servers" });

export async function getAgentServers(
  env: IEnv,
  agentId: string,
  userId: number,
) {
  const agent = await getValidatedAgent(env, agentId, userId);

  if (!agent.servers) {
    return [];
  }

  let serverConfigs: Array<{ url: string; type: "sse" }> = [];
  try {
    const serversJson = agent.servers as string;
    serverConfigs = JSON.parse(serversJson) as Array<{
      url: string;
      type: "sse";
    }>;
  } catch (error) {
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

async function getValidatedAgent(env: IEnv, agentId: string, userId: number) {
  const { AgentRepository } = await import("~/repositories/AgentRepository");
  const repo = new AgentRepository(env);
  const agent = await repo.getAgentById(agentId);

  if (!agent) {
    throw new AssistantError("Agent not found", ErrorType.NOT_FOUND);
  }

  if (agent.user_id !== userId) {
    throw new AssistantError("Forbidden", ErrorType.AUTHENTICATION_ERROR);
  }

  return agent;
}
