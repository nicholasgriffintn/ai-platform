import type {
	AssistantRecipe,
	AssistantRecipeInstallResponse,
	AssistantRecipesResponse,
	RecipeConfiguration,
	RecipeInstallation,
	RecipeInstallationTrigger,
	RecipeInstallationUpdateRequest,
	RecipeInstallationsResponse,
} from "@assistant/schemas";
import { apiService } from "./api-service";
import { fetchApi, returnFetchedData } from "./fetch-wrapper";

export async function listAssistantRecipes(): Promise<AssistantRecipesResponse> {
	let headers = {};
	try {
		headers = await apiService.getHeaders();
	} catch (error) {
		console.error("Error preparing recipe headers:", error);
	}

	const response = await fetchApi("/apps/recipes", { method: "GET", headers });
	if (!response.ok) {
		throw new Error("Failed to fetch assistant recipes");
	}

	return returnFetchedData<AssistantRecipesResponse>(response);
}

export async function getAssistantRecipe(recipeId: string): Promise<AssistantRecipe> {
	let headers = {};
	try {
		headers = await apiService.getHeaders();
	} catch (error) {
		console.error("Error preparing recipe headers:", error);
	}

	const response = await fetchApi(`/apps/recipes/${recipeId}`, { method: "GET", headers });
	if (!response.ok) {
		throw new Error("Failed to fetch assistant recipe");
	}

	return returnFetchedData<AssistantRecipe>(response);
}

export async function installAssistantRecipe(
	recipeId: string,
	triggers?: RecipeInstallationTrigger[],
	configuration?: RecipeConfiguration,
): Promise<AssistantRecipeInstallResponse> {
	let headers = {};
	try {
		headers = await apiService.getHeaders();
	} catch (error) {
		console.error("Error preparing recipe install headers:", error);
	}

	const response = await fetchApi(`/apps/recipes/${recipeId}/install`, {
		method: "POST",
		headers,
		body: { channel: "web", triggers, configuration },
	});
	if (!response.ok) {
		throw new Error("Failed to start assistant recipe");
	}

	return returnFetchedData<AssistantRecipeInstallResponse>(response);
}

export async function listRecipeInstallations(): Promise<RecipeInstallationsResponse> {
	let headers = {};
	try {
		headers = await apiService.getHeaders();
	} catch (error) {
		console.error("Error preparing recipe installation headers:", error);
	}

	const response = await fetchApi("/apps/recipes/installations", { method: "GET", headers });
	if (!response.ok) {
		throw new Error("Failed to fetch installed assistant recipes");
	}

	return returnFetchedData<RecipeInstallationsResponse>(response);
}

export async function updateRecipeInstallation(
	installationId: string,
	update: RecipeInstallationUpdateRequest,
): Promise<RecipeInstallation> {
	let headers = {};
	try {
		headers = await apiService.getHeaders();
	} catch (error) {
		console.error("Error preparing recipe installation update headers:", error);
	}

	const response = await fetchApi(`/apps/recipes/installations/${installationId}`, {
		method: "PUT",
		headers,
		body: update,
	});
	if (!response.ok) {
		throw new Error("Failed to update installed assistant recipe");
	}

	return returnFetchedData<RecipeInstallation>(response);
}

export async function deleteRecipeInstallation(installationId: string): Promise<void> {
	let headers = {};
	try {
		headers = await apiService.getHeaders();
	} catch (error) {
		console.error("Error preparing recipe installation delete headers:", error);
	}

	const response = await fetchApi(`/apps/recipes/installations/${installationId}`, {
		method: "DELETE",
		headers,
	});
	if (!response.ok) {
		throw new Error("Failed to delete installed assistant recipe");
	}
}
