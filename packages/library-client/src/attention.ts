import type { WorkAttentionQuery, WorkAttentionResponse } from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export async function listWorkAttention(query: WorkAttentionQuery): Promise<WorkAttentionResponse> {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }

  const response = await fetchApiOrThrow(`/workspaces/attention?${search.toString()}`, {
    method: "GET",
    headers: await apiService.getHeaders(),
  });

  return returnFetchedData<WorkAttentionResponse>(response);
}
