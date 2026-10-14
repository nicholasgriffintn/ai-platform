import type {
  ModelToolId,
  SavedToolConfiguration,
  SavedToolConfigurationsResponse,
  SaveToolConfiguration,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApi } from "./fetch-wrapper.js";
import { createApiErrorFromResponse, returnFetchedData } from "./http.js";

async function readHeaders(): Promise<Record<string, string>> {
  return await apiService.getHeaders();
}

export async function fetchToolConfigurations(): Promise<SavedToolConfiguration[]> {
  const response = await fetchApi("/tools/configurations", {
    method: "GET",
    headers: await readHeaders(),
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to load tool configurations");
  }

  return (await returnFetchedData<SavedToolConfigurationsResponse>(response)).data;
}

export async function saveToolConfiguration(
  toolId: ModelToolId,
  input: SaveToolConfiguration,
): Promise<SavedToolConfiguration> {
  const response = await fetchApi(`/tools/${encodeURIComponent(toolId)}/configuration`, {
    method: "PATCH",
    headers: await readHeaders(),
    body: input,
  });

  if (!response.ok) {
    throw await createApiErrorFromResponse(response, "Failed to save tool configuration");
  }

  return returnFetchedData<SavedToolConfiguration>(response);
}
