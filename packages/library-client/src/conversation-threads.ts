import type { ConversationThreadsResponse } from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApiOrThrow } from "./fetch-wrapper";
import { returnFetchedData } from "./http";

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
