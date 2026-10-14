import type {
  ConversationGroup,
  ConversationGroupScope,
  ConversationOrganisation,
  CreateConversationGroup,
  UpdateConversationOrganisation,
} from "@ngriffin_uk/polychat-schemas";

import { resource } from "./resource.js";

const conversations = resource<unknown>("/conversations");
const conversationGroups = resource<ConversationGroup, CreateConversationGroup>(
  "/conversations/groups",
);

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

export function createConversationGroup(
  name: string,
  scope: ConversationGroupScope,
): Promise<ConversationGroup> {
  return conversationGroups.create({ name, scope });
}

export async function deleteConversationGroup(groupId: string): Promise<{ deleted: boolean }> {
  await conversationGroups.delete(groupId);

  return { deleted: true };
}
