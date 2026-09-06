import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import type {
  ConversationGroup,
  ConversationGroupScope,
  ConversationOrganisation,
  UpdateConversationOrganisation,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApiOrThrow } from "./fetch-wrapper";

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
  return authenticatedRequest(`/chat/completions/${conversationId}/organisation`, "GET");
}

export function updateConversationOrganisation(
  conversationId: string,
  input: UpdateConversationOrganisation,
): Promise<ConversationOrganisation> {
  return authenticatedRequest(`/chat/completions/${conversationId}/organisation`, "PATCH", input);
}

export function moveConversationToGroup(
  conversationId: string,
  groupId: string | null,
): Promise<ConversationOrganisation> {
  return authenticatedRequest(`/chat/completions/${conversationId}/group`, "PUT", { groupId });
}

export function createConversationGroup(
  name: string,
  scope: ConversationGroupScope,
): Promise<ConversationGroup> {
  return authenticatedRequest("/chat/groups", "POST", { name, scope });
}

export function deleteConversationGroup(groupId: string): Promise<{ deleted: boolean }> {
  return authenticatedRequest(`/chat/groups/${groupId}`, "DELETE");
}
