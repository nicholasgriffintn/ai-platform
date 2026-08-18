import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import type {
  ComposioTriggerTypesResponse,
  RecipeComposioTrigger,
  RecipeComposioTriggerCreateRequest,
  RecipeComposioTriggersResponse,
  RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApiOrThrow } from "./fetch-wrapper";

async function getAuthHeaders() {
  try {
    return await apiService.getHeaders();
  } catch (error) {
    console.error("Error preparing recipe event trigger headers:", error);

    return {};
  }
}

export async function listRecipeComposioTriggerTypes(
  installationId: string,
  providerId: RecipeConnectorProvider,
): Promise<ComposioTriggerTypesResponse> {
  const query = new URLSearchParams({ providerId });
  const response = await fetchApiOrThrow(
    `/apps/recipes/installations/${encodeURIComponent(installationId)}/composio-trigger-types?${query.toString()}`,
    { method: "GET", headers: await getAuthHeaders() },
  );

  return returnFetchedData<ComposioTriggerTypesResponse>(response);
}

export async function listRecipeComposioTriggers(
  installationId: string,
): Promise<RecipeComposioTriggersResponse> {
  const response = await fetchApiOrThrow(
    `/apps/recipes/installations/${encodeURIComponent(installationId)}/composio-triggers`,
    { method: "GET", headers: await getAuthHeaders() },
  );

  return returnFetchedData<RecipeComposioTriggersResponse>(response);
}

export async function createRecipeComposioTrigger(
  installationId: string,
  input: RecipeComposioTriggerCreateRequest,
): Promise<RecipeComposioTrigger> {
  const response = await fetchApiOrThrow(
    `/apps/recipes/installations/${encodeURIComponent(installationId)}/composio-triggers`,
    { method: "POST", headers: await getAuthHeaders(), body: input },
  );

  return returnFetchedData<RecipeComposioTrigger>(response);
}

export async function updateRecipeComposioTrigger(
  triggerId: string,
  status: "active" | "paused",
): Promise<RecipeComposioTrigger> {
  const response = await fetchApiOrThrow(
    `/apps/recipes/composio-triggers/${encodeURIComponent(triggerId)}`,
    { method: "PUT", headers: await getAuthHeaders(), body: { status } },
  );

  return returnFetchedData<RecipeComposioTrigger>(response);
}

export async function deleteRecipeComposioTrigger(triggerId: string): Promise<void> {
  await fetchApiOrThrow(`/apps/recipes/composio-triggers/${encodeURIComponent(triggerId)}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
}
