import type {
  AssistantRecipeInstallResponse,
  AssistantRecipesResponse,
  RecipeConfiguration,
  RecipeInvocationResponse,
  InstalledRecipe,
  RecipeInstallation,
  RecipeInstallationTrigger,
  RecipeInstallationUpdateRequest,
  RecipeInstallationsResponse,
  ListPage,
  SpendLedger,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApi, fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";
import { requestJson, resource } from "./resource.js";

export async function listAssistantRecipes(): Promise<AssistantRecipesResponse> {
  const page = await requestJson<
    ListPage<AssistantRecipesResponse["recipes"][number]> &
      Pick<AssistantRecipesResponse, "categories" | "filters">
  >("/recipes", "GET");

  return { recipes: page.data, categories: page.categories, filters: page.filters };
}

export async function installAssistantRecipe(
  recipeId: string,
  triggers?: RecipeInstallationTrigger[],
  configuration?: RecipeConfiguration,
  projectId?: string,
): Promise<AssistantRecipeInstallResponse> {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error preparing recipe install headers:", error);
  }

  const response = await fetchApiOrThrow(`/recipes/${encodeURIComponent(recipeId)}/install`, {
    method: "POST",
    headers,
    body: { channel: "web", triggers, configuration, projectId },
  });

  return returnFetchedData<AssistantRecipeInstallResponse>(response);
}

export async function invokeAssistantRecipe(
  recipeId: string,
  input?: string,
  projectId?: string,
  options: { dryRun?: boolean } = {},
): Promise<RecipeInvocationResponse> {
  let headers = {};

  try {
    headers = await apiService.getHeaders();
  } catch (error) {
    console.error("Error preparing recipe invocation headers:", error);
  }

  const response = await fetchApiOrThrow(`/recipes/${encodeURIComponent(recipeId)}/invoke`, {
    method: "POST",
    headers,
    body: {
      channel: "web",
      input,
      projectId,
      ...(options.dryRun ? { dryRun: true, queue: true } : {}),
    },
  });

  return returnFetchedData<RecipeInvocationResponse>(response);
}

export async function listRecipeInstallations(
  projectId?: string,
): Promise<RecipeInstallationsResponse> {
  return {
    installations: await resource<InstalledRecipe>("/recipes/installations").listAll({
      project_id: projectId,
    }),
  };
}

export function getRecipeInstallationSpend(installationId: string): Promise<SpendLedger> {
  return resource<InstalledRecipe>("/recipes/installations")
    .singleton<SpendLedger>(installationId, "spend")
    .get();
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

  const response = await fetchApi(`/recipes/installations/${encodeURIComponent(installationId)}`, {
    method: "PATCH",
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

  const response = await fetchApi(`/recipes/installations/${encodeURIComponent(installationId)}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to delete installed assistant recipe");
  }
}
