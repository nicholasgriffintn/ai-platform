import type {
	RecipeConnectorAccount,
	RecipeConnectorAccountUpdateRequest,
	RecipeConnectorApiKeyRequest,
	RecipeConnectorProvider,
	RecipeConnectorsResponse,
	RecipeConnectorStartResponse,
} from "@ngriffin_uk/polychat-schemas";
import { apiService } from "./api-service";
import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import { fetchApiOrThrow } from "./fetch-wrapper";

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
	authConfigId?: string,
): Promise<RecipeConnectorStartResponse> {
	const response = await fetchApiOrThrow(`/apps/connectors/${provider}/start`, {
		method: "POST",
		headers: await getAuthHeaders(),
		body: { returnTo, authConfigId },
	});
	return returnFetchedData<RecipeConnectorStartResponse>(response);
}

export async function storeRecipeConnectorApiKey(
	provider: RecipeConnectorProvider,
	request: RecipeConnectorApiKeyRequest,
): Promise<{ success: boolean }> {
	const response = await fetchApiOrThrow(`/apps/connectors/${provider}/api-key`, {
		method: "POST",
		headers: await getAuthHeaders(),
		body: request,
	});
	return returnFetchedData<{ success: boolean }>(response);
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

export async function listRecipeConnectorAccounts(
	provider: RecipeConnectorProvider,
): Promise<{ accounts: RecipeConnectorAccount[] }> {
	const response = await fetchApiOrThrow(`/apps/connectors/${provider}/accounts`, {
		method: "GET",
		headers: await getAuthHeaders(),
	});
	return returnFetchedData<{ accounts: RecipeConnectorAccount[] }>(response);
}

export async function updateRecipeConnectorAccount(
	provider: RecipeConnectorProvider,
	request: RecipeConnectorAccountUpdateRequest,
): Promise<RecipeConnectorAccount> {
	const response = await fetchApiOrThrow(`/apps/connectors/${provider}/accounts`, {
		method: "PUT",
		headers: await getAuthHeaders(),
		body: request,
	});
	return returnFetchedData<RecipeConnectorAccount>(response);
}

export async function resolveConnectorOperationApproval(
	approvalId: string,
	resolution: "approved" | "rejected",
): Promise<{ approval: { id: string; state: "approved" | "rejected" } }> {
	const response = await fetchApiOrThrow(`/apps/connectors/approvals/${approvalId}`, {
		method: "PUT",
		headers: await getAuthHeaders(),
		body: { resolution },
	});
	return returnFetchedData<{ approval: { id: string; state: "approved" | "rejected" } }>(response);
}
