import type { MCPClientManager } from "agents/mcp/client";
import z from "zod";

import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/agents/mcp-client" });

export interface MCPServerConfig {
	url: string;
	type?: "sse" | "streamable-http" | "auto";
	name?: string;
}

export interface MCPToolName {
	shortAgentId: string;
	toolName: string;
}

export interface AgentMCPToolDefinition {
	name: string;
	description?: string;
	parameters: Record<string, unknown>;
}

type MCPConnection = MCPClientManager["mcpConnections"][string];

const mcpServerConfigSchema = z.object({
	url: z.string(),
	type: z.enum(["sse", "streamable-http", "auto"]).optional(),
	name: z.string().optional(),
});
const mcpToolParametersSchema = z
	.object({
		properties: z.unknown().optional(),
		jsonSchema: z
			.object({
				properties: z.unknown().optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough()
	.refine((parameters) => Boolean(parameters.properties || parameters.jsonSchema?.properties));
const mcpAIToolSchema = z.object({
	description: z.string().optional(),
	parameters: mcpToolParametersSchema,
});

function createServerId(url: string): string {
	let hash = 0;
	for (const char of url) {
		hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	}
	return `server-${hash.toString(36)}`;
}

function createServerName(config: MCPServerConfig): string {
	if (config.name?.trim()) {
		return config.name.trim();
	}

	try {
		return new URL(config.url).hostname || config.url;
	} catch {
		return config.url;
	}
}

export function parseMCPServerConfigs(servers: unknown): MCPServerConfig[] {
	const parsed = typeof servers === "string" ? safeParseJson(servers) : servers;
	if (!Array.isArray(parsed)) {
		throw new AssistantError("Invalid servers configuration", ErrorType.PARAMS_ERROR);
	}

	return parsed.flatMap((config): MCPServerConfig[] => {
		const result = mcpServerConfigSchema.safeParse(config);
		return result.success ? [result.data] : [];
	});
}

export function createMCPToolName(agentId: string, toolName: string): string {
	return `mcp_${agentId.substring(0, 8)}_${toolName}`;
}

export function parseMCPToolName(functionName: string): MCPToolName | null {
	const parts = functionName.split("_");
	if (parts.length < 3 || parts[0] !== "mcp") {
		return null;
	}

	return {
		shortAgentId: parts[1],
		toolName: parts.slice(2).join("_"),
	};
}

export function resolveMCPAIToolDefinition(
	agentId: string,
	name: string,
	definition: unknown,
): AgentMCPToolDefinition | null {
	const parsed = mcpAIToolSchema.safeParse(definition);
	if (!parsed.success) {
		return null;
	}

	return {
		name: createMCPToolName(agentId, name),
		description: parsed.data.description,
		parameters: parsed.data.parameters,
	};
}

export async function connectMCPServerReady(
	mcp: MCPClientManager,
	config: MCPServerConfig,
): Promise<{ id: string; connection: MCPConnection } | { id: string; error: string }> {
	const id = createServerId(config.url);
	await mcp.registerServer(id, {
		url: config.url,
		name: createServerName(config),
		transport: {
			type: config.type ?? "auto",
		},
	});

	const connectionResult = await mcp.connectToServer(id);
	if (connectionResult.state === "failed") {
		return { id, error: connectionResult.error };
	}
	if (connectionResult.state === "authenticating") {
		return { id, error: "MCP server requires authentication" };
	}

	const discoveryResult = await mcp.discoverIfConnected(id, { timeoutMs: 10_000 });
	if (discoveryResult && !discoveryResult.success) {
		logger.error("MCP discovery failed", {
			server_id: id,
			server_url: config.url,
			error_message: discoveryResult.error ?? "Unknown discovery error",
		});
		return { id, error: discoveryResult.error ?? "MCP discovery failed" };
	}

	await mcp.waitForConnections({ timeout: 10_000 });

	const connection = mcp.mcpConnections[id];
	if (!connection?.connectionState) {
		return { id, error: "MCP connection was not created" };
	}
	if (connection.connectionState !== "ready") {
		return { id, error: `MCP connection is ${connection.connectionState}` };
	}

	return { id, connection };
}
