import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import type {
  ConversationLabel,
  ConversationLabelScope,
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

export function setConversationLabel(
  conversationId: string,
  labelId: string,
  assigned: boolean,
): Promise<ConversationOrganisation> {
  return authenticatedRequest(`/chat/completions/${conversationId}/labels`, "PUT", {
    labelId,
    assigned,
  });
}

export function createConversationLabel(
  name: string,
  scope: ConversationLabelScope,
): Promise<ConversationLabel> {
  return authenticatedRequest("/chat/labels", "POST", { name, scope });
}

export function deleteConversationLabel(labelId: string): Promise<{ deleted: boolean }> {
  return authenticatedRequest(`/chat/labels/${labelId}`, "DELETE");
}
