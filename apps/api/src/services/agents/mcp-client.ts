import type { MCPClientManager } from "agents/mcp/client";

import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/agents/mcp-client" });

export interface MCPServerConfig {
	url: string;
	type?: "sse" | "streamable-http" | "auto";
	name?: string;
}

type MCPConnection = MCPClientManager["mcpConnections"][string];

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
