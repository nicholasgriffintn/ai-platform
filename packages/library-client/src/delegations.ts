import type { DelegationListResponse } from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export async function listConversationDelegations(
  conversationId: string,
): Promise<DelegationListResponse> {
  const response = await fetchApiOrThrow(`/chat/completions/${conversationId}/delegations`, {
    method: "GET",
    headers: await apiService.getHeaders(),
  });

  return returnFetchedData(response);
}
