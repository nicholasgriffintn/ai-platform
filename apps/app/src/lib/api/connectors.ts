import type {
	RecipeConnectorProvider,
	RecipeConnectorsResponse,
	RecipeConnectorStartResponse,
} from "@assistant/schemas";
import { apiService } from "./api-service";
import { fetchApiOrThrow, returnFetchedData } from "./fetch-wrapper";

async function getAuthHeaders() {
	try {
		return await apiService.getHeaders();
	} catch (error) {
		console.error("Error preparing connector headers:", error);
		return {};
	}
}

export async function listRecipeConnectors(): Promise<RecipeConnectorsResponse> {
	const response = await fetchApiOrThrow("/apps/connectors", {
		method: "GET",
		headers: await getAuthHeaders(),
	});
	return returnFetchedData<RecipeConnectorsResponse>(response);
}

export async function startRecipeConnector(
	provider: RecipeConnectorProvider,
	returnTo?: string,
): Promise<RecipeConnectorStartResponse> {
	const response = await fetchApiOrThrow(`/apps/connectors/${provider}/start`, {
		method: "POST",
		headers: await getAuthHeaders(),
		body: { returnTo },
	});
	return returnFetchedData<RecipeConnectorStartResponse>(response);
}

export async function disconnectRecipeConnector(
	provider: RecipeConnectorProvider,
): Promise<{ success: boolean }> {
	const response = await fetchApiOrThrow(`/apps/connectors/${provider}`, {
		method: "DELETE",
		headers: await getAuthHeaders(),
	});
	return returnFetchedData<{ success: boolean }>(response);
}
