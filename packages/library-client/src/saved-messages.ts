import type { SaveMessageInput, SavedMessage } from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

const BASE_PATH = "/chat/saved-messages";

export async function listSavedMessages(limit?: number): Promise<{ messages: SavedMessage[] }> {
  const query = limit ? `?limit=${limit}` : "";
  const response = await fetchApiOrThrow(`${BASE_PATH}${query}`, {
    method: "GET",
    headers: await apiService.getHeaders(),
  });

  return returnFetchedData<{ messages: SavedMessage[] }>(response);
}

export async function saveMessage(input: SaveMessageInput): Promise<void> {
  await fetchApiOrThrow(BASE_PATH, {
    method: "POST",
    headers: await apiService.getHeaders(),
    body: input,
  });
}

export async function unsaveMessage(messageId: string): Promise<void> {
  await fetchApiOrThrow(`${BASE_PATH}/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });
}
