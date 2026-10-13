import type {
  ConversationGroup,
  ConversationGroupScope,
  ConversationOrganisation,
  UpdateConversationOrganisation,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service.js";
import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";

async function authenticatedRequest<T>(path: string, method: string, body?: object): Promise<T> {
  const response = await fetchApiOrThrow(path, {
    method,
    headers: await apiService.getHeaders(),
    body,
  });

  return returnFetchedData<T>(response);
}

export function getConversationOrganisation(
  conversationId: string,
): Promise<ConversationOrganisation> {
  return authenticatedRequest(
    `/conversations/${encodeURIComponent(conversationId)}/organisation`,
    "GET",
  );
}

export function updateConversationOrganisation(
  conversationId: string,
  input: UpdateConversationOrganisation,
): Promise<ConversationOrganisation> {
  return authenticatedRequest(
    `/conversations/${encodeURIComponent(conversationId)}/organisation`,
    "PATCH",
    input,
  );
}

export function moveConversationToGroup(
  conversationId: string,
  groupId: string | null,
): Promise<ConversationOrganisation> {
  return authenticatedRequest(`/conversations/${encodeURIComponent(conversationId)}/group`, "PUT", {
    groupId,
  });
}

export function createConversationGroup(
  name: string,
  scope: ConversationGroupScope,
): Promise<ConversationGroup> {
  return authenticatedRequest("/conversations/groups", "POST", { name, scope });
}

export function deleteConversationGroup(groupId: string): Promise<{ deleted: boolean }> {
  return authenticatedRequest(`/conversations/groups/${encodeURIComponent(groupId)}`, "DELETE");
}
