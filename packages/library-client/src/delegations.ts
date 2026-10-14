import type { ConversationHandle, DelegationListResponse } from "@ngriffin_uk/polychat-schemas";

import { requestJson, resource } from "./resource.js";

const conversations = resource<unknown>("/conversations");

export function listConversationDelegations(
  conversationId: string,
): Promise<DelegationListResponse> {
  return requestJson<DelegationListResponse>(
    conversations.sub<unknown>(conversationId, "delegations").path,
    "GET",
  );
}

export async function cancelConversationDelegations(conversationId: string): Promise<void> {
  await conversations.sub<unknown>(conversationId, "delegations").collectionAction("cancel");
}

export function listConversationHandles(): Promise<ConversationHandle[]> {
  return resource<ConversationHandle>("/conversations/handles").listAll();
}

export function revokeConversationHandle(handleId: string): Promise<void> {
  return resource<ConversationHandle>("/conversations/handles").delete(handleId);
}
