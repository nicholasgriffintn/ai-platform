import type { McpConnection, McpConnectionInput } from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export async function listMcpConnections(): Promise<{ connections: McpConnection[] }> {
  return returnFetchedData(
    await fetchApiOrThrow("/tools/mcp/connections", {
      headers: await apiService.getHeaders(),
    }),
  );
}

export async function createMcpConnection(input: McpConnectionInput): Promise<McpConnection> {
  return returnFetchedData(
    await fetchApiOrThrow("/tools/mcp/connections", {
      method: "POST",
      headers: await apiService.getHeaders(),
      body: input,
    }),
  );
}

export async function deleteMcpConnection(id: string): Promise<void> {
  await fetchApiOrThrow(`/tools/mcp/connections/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });
}
