import type {
  RecipeWebhookTrigger,
  RecipeWebhookTriggerCreateRequest,
  RecipeWebhookTriggerSecret,
  RecipeWebhookTriggersResponse,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

async function getAuthHeaders() {
  try {
    return await apiService.getHeaders();
  } catch (error) {
    console.error("Error preparing recipe webhook headers:", error);

    return {};
  }
}

export async function listRecipeWebhookTriggers(
  installationId: string,
): Promise<RecipeWebhookTriggersResponse> {
  const response = await fetchApiOrThrow(
    `/apps/recipes/installations/${encodeURIComponent(installationId)}/webhook-triggers`,
    { method: "GET", headers: await getAuthHeaders() },
  );

  return returnFetchedData<RecipeWebhookTriggersResponse>(response);
}

export async function createRecipeWebhookTrigger(
  installationId: string,
  input: RecipeWebhookTriggerCreateRequest,
): Promise<RecipeWebhookTriggerSecret> {
  const response = await fetchApiOrThrow(
    `/apps/recipes/installations/${encodeURIComponent(installationId)}/webhook-triggers`,
    { method: "POST", headers: await getAuthHeaders(), body: input },
  );

  return returnFetchedData<RecipeWebhookTriggerSecret>(response);
}

export async function updateRecipeWebhookTrigger(
  triggerId: string,
  status: "active" | "paused",
): Promise<RecipeWebhookTrigger> {
  const response = await fetchApiOrThrow(
    `/apps/recipes/webhook-triggers/${encodeURIComponent(triggerId)}`,
    { method: "PUT", headers: await getAuthHeaders(), body: { status } },
  );

  return returnFetchedData<RecipeWebhookTrigger>(response);
}

export async function rotateRecipeWebhookTrigger(
  triggerId: string,
): Promise<RecipeWebhookTriggerSecret> {
  const response = await fetchApiOrThrow(
    `/apps/recipes/webhook-triggers/${encodeURIComponent(triggerId)}/rotate`,
    { method: "POST", headers: await getAuthHeaders() },
  );

  return returnFetchedData<RecipeWebhookTriggerSecret>(response);
}

export async function deleteRecipeWebhookTrigger(triggerId: string): Promise<void> {
  await fetchApiOrThrow(`/apps/recipes/webhook-triggers/${encodeURIComponent(triggerId)}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
}
