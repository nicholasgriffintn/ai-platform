import type {
	ModelToolId,
	SavedToolConfiguration,
	SavedToolConfigurationsResponse,
	SaveToolConfiguration,
} from "@ngriffin_uk/polychat-schemas";
import {
	createApiErrorFromResponse,
	returnFetchedData,
} from "@ngriffin_uk/polychat-library-client";

import { apiService } from "./api-service";
import { fetchApi } from "./fetch-wrapper";

async function readHeaders(): Promise<Record<string, string>> {
	return (await apiService.getHeaders()) as Record<string, string>;
}

export async function fetchToolConfigurations(): Promise<SavedToolConfigurationsResponse> {
	const response = await fetchApi("/tools/configurations", {
		method: "GET",
		headers: await readHeaders(),
	});
	if (!response.ok) {
		throw await createApiErrorFromResponse(response, "Failed to load tool configurations");
	}
	return returnFetchedData<SavedToolConfigurationsResponse>(response);
}

export async function saveToolConfiguration(
	toolId: ModelToolId,
	input: SaveToolConfiguration,
): Promise<SavedToolConfiguration> {
	const response = await fetchApi(`/tools/${encodeURIComponent(toolId)}/configuration`, {
		method: "PUT",
		headers: await readHeaders(),
		body: input,
	});
	if (!response.ok) {
		throw await createApiErrorFromResponse(response, "Failed to save tool configuration");
	}
	return returnFetchedData<SavedToolConfiguration>(response);
}
