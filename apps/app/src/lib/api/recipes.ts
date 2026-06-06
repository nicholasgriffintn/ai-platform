import type {
	AssistantRecipe,
	AssistantRecipeInstallResponse,
	AssistantRecipesResponse,
} from "@assistant/schemas";
import { fetchApi, returnFetchedData } from "./fetch-wrapper";

export async function listAssistantRecipes(): Promise<AssistantRecipesResponse> {
	const response = await fetchApi("/apps/recipes", { method: "GET" });
	if (!response.ok) {
		throw new Error("Failed to fetch assistant recipes");
	}

	return returnFetchedData<AssistantRecipesResponse>(response);
}

export async function getAssistantRecipe(recipeId: string): Promise<AssistantRecipe> {
	const response = await fetchApi(`/apps/recipes/${recipeId}`, { method: "GET" });
	if (!response.ok) {
		throw new Error("Failed to fetch assistant recipe");
	}

	return returnFetchedData<AssistantRecipe>(response);
}

export async function installAssistantRecipe(
	recipeId: string,
): Promise<AssistantRecipeInstallResponse> {
	const response = await fetchApi(`/apps/recipes/${recipeId}/install`, {
		method: "POST",
		body: { channel: "web" },
	});
	if (!response.ok) {
		throw new Error("Failed to start assistant recipe");
	}

	return returnFetchedData<AssistantRecipeInstallResponse>(response);
}
