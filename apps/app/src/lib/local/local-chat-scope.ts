import type { Conversation } from "~/types/chat";

export const ANONYMOUS_LOCAL_CHAT_SCOPE = "anonymous";

export function getLocalChatScope(userId?: number | null): string {
	return userId ? `user:${userId}` : ANONYMOUS_LOCAL_CHAT_SCOPE;
}

export function isConversationInLocalScope(conversation: Conversation, scope: string): boolean {
	return (
		conversation.localOwnerScope === scope ||
		(conversation.localOwnerScope === undefined && scope === ANONYMOUS_LOCAL_CHAT_SCOPE)
	);
}
