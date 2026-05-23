import type { Conversation } from "~/types";
import { generateId } from "./utils";

export function createConversationId(): string {
	return generateId();
}

export function preserveOptimisticMessages(
	fetchedConversation: Conversation | null | undefined,
	cachedConversation: Conversation | null | undefined,
): Conversation | null | undefined {
	if (!fetchedConversation || !cachedConversation?.messages?.length) {
		return fetchedConversation || cachedConversation;
	}

	const fetchedMessageCount = fetchedConversation.messages?.length || 0;
	const cachedMessageCount = cachedConversation.messages.length;

	if (cachedMessageCount <= fetchedMessageCount) {
		return fetchedConversation;
	}

	return {
		...fetchedConversation,
		...cachedConversation,
		is_public: fetchedConversation.is_public ?? cachedConversation.is_public,
		share_id: fetchedConversation.share_id ?? cachedConversation.share_id,
	};
}
