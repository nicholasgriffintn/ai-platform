import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import type { ConversationBranchesResponse } from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApiOrThrow } from "./fetch-wrapper";

export async function getConversationBranches(
  conversationId: string,
): Promise<ConversationBranchesResponse> {
  const response = await fetchApiOrThrow(
    `/chat/completions/${encodeURIComponent(conversationId)}/branches`,
    {
      method: "GET",
      headers: await apiService.getHeaders(),
    },
  );

  return returnFetchedData(response);
}
