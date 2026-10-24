import type {
  ConversationOrganisation,
  UpdateConversationOrganisation,
} from "@ngriffin_uk/polychat-schemas";

import { resource } from "./resource.js";

const conversations = resource<unknown>("/conversations");

function organisation(conversationId: string) {
  return conversations.singleton<ConversationOrganisation, UpdateConversationOrganisation>(
    conversationId,
    "organisation",
  );
}

export function getConversationOrganisation(
  conversationId: string,
): Promise<ConversationOrganisation> {
  return organisation(conversationId).get();
}

export function updateConversationOrganisation(
  conversationId: string,
  input: UpdateConversationOrganisation,
): Promise<ConversationOrganisation> {
  return organisation(conversationId).update(input);
}

export function moveConversationToGroup(
  conversationId: string,
  groupId: string | null,
): Promise<ConversationOrganisation> {
  return organisation(conversationId).update({ groupId });
}
