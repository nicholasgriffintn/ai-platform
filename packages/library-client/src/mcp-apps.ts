import type { McpAppCallToolResult, McpAppToolCallRequest } from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApi } from "./fetch-wrapper.js";
import { createApiErrorFromResponse, returnFetchedData } from "./http.js";

export async function callMcpAppTool(
  request: McpAppToolCallRequest,
): Promise<McpAppCallToolResult> {
  const response = await fetchApi("/tools/mcp_calls", {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: request,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "The app's tool call failed");
  }

  return returnFetchedData<McpAppCallToolResult>(response);
}
