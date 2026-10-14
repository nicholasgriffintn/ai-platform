import {
  mcpOAuthStartResponseSchema,
  type McpConnection,
  type McpConnectionInput,
  type McpOAuthStartInput,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";
import { resource } from "./resource.js";

const MCP_CONNECTIONS_PATH = "/tools/mcp_connections";

export function listMcpConnections(): Promise<McpConnection[]> {
  return resource<McpConnection>(MCP_CONNECTIONS_PATH).listAll();
}

export async function createMcpConnection(input: McpConnectionInput): Promise<McpConnection> {
  return returnFetchedData(
    await fetchApiOrThrow(MCP_CONNECTIONS_PATH, {
      method: "POST",
      headers: await apiService.getHeaders(),
      body: input,
    }),
  );
}

export async function deleteMcpConnection(id: string): Promise<void> {
  await fetchApiOrThrow(`${MCP_CONNECTIONS_PATH}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });
}

export async function startMcpOAuthConnection(
  input: McpOAuthStartInput,
): Promise<{ authorizationUrl: string }> {
  return mcpOAuthStartResponseSchema.parse(
    await returnFetchedData<unknown>(
      await fetchApiOrThrow(`${MCP_CONNECTIONS_PATH}/authorise`, {
        method: "POST",
        headers: await apiService.getHeaders(),
        body: input,
      }),
    ),
  );
}
