import type {
  ConversationHandleListResponse,
  DelegationListResponse,
} from "@ngriffin_uk/polychat-schemas";

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

export async function cancelConversationDelegations(conversationId: string): Promise<void> {
  await fetchApiOrThrow(`/chat/completions/${conversationId}/delegations/cancel`, {
    method: "POST",
    headers: await apiService.getHeaders(),
  });
}

export async function listConversationHandles(): Promise<ConversationHandleListResponse> {
  const response = await fetchApiOrThrow("/user/conversation-handles", {
    method: "GET",
    headers: await apiService.getHeaders(),
  });

  return returnFetchedData(response);
}

export async function revokeConversationHandle(handleId: string): Promise<void> {
  await fetchApiOrThrow(`/user/conversation-handles/${encodeURIComponent(handleId)}`, {
    method: "DELETE",
    headers: await apiService.getHeaders(),
  });
}
