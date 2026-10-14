import type { ConversationThread, ListPage } from "@ngriffin_uk/polychat-schemas";

import { resource } from "./resource.js";

const conversations = resource<unknown>("/conversations");

export function getConversationBranches(
  conversationId: string,
): Promise<ListPage<ConversationThread>> {
  return conversations.sub<ConversationThread>(conversationId, "branches").list();
}
