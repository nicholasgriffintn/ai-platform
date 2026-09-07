import type { ConversationThreadsResponse } from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

export async function getConversationBranches(
  conversationId: string,
): Promise<ConversationThreadsResponse> {
  const response = await fetchApiOrThrow(
    `/chat/completions/${encodeURIComponent(conversationId)}/threads`,
    {
      method: "GET",
      headers: await apiService.getHeaders(),
    },
  );

  return returnFetchedData(response);
}
