import type {
  McpAppCallToolResult,
  McpAppEntryOpenRequest,
  McpAppToolCallRequest,
  McpAppView,
  RemoteAppListResponse,
  AppSettingsResponse,
} from "@ngriffin_uk/polychat-schemas";

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

export async function openMcpAppEntry(request: McpAppEntryOpenRequest): Promise<McpAppView> {
  const response = await fetchApi("/capabilities/remote_app_views", {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: request,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "The app could not be opened");
  }

  return returnFetchedData<McpAppView>(response);
}

export async function fetchRemoteApps(): Promise<RemoteAppListResponse> {
  const response = await fetchApi("/capabilities/remote_apps", {
    method: "GET",
    headers: await apiService.getHeaders(),
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Apps from your MCP servers are unavailable");
  }

  return returnFetchedData<RemoteAppListResponse>(response);
}

export async function setAppEnabled(appId: string, enabled: boolean): Promise<AppSettingsResponse> {
  const response = await fetchApi(`/capabilities/apps/${encodeURIComponent(appId)}`, {
    method: "PUT",
    headers: await apiService.getHeaders(),
    body: { enabled },
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "The app setting could not be saved");
  }

  return returnFetchedData<AppSettingsResponse>(response);
}
