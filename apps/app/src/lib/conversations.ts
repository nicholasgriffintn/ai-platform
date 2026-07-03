import type { Conversation } from "~/types";
import { generateId } from "./utils";

export function createConversationId(): string {
	return generateId();
}

type ConversationMessage = Conversation["messages"][number];

function hasRenderableMessagePayload(message: ConversationMessage): boolean {
	if (typeof message.content === "string" && message.content.trim()) {
		return true;
	}

	if (Array.isArray(message.content) && message.content.length > 0) {
		return true;
	}

	if (message.reasoning?.content?.trim()) {
		return true;
	}

	if (Array.isArray(message.parts) && message.parts.length > 0) {
		return true;
	}

	return false;
}

function hasVisibleTextPayload(message: ConversationMessage): boolean {
	if (typeof message.content === "string" && message.content.trim()) {
		return true;
	}

	if (Array.isArray(message.content)) {
		return message.content.some((part) => part.type === "text" && part.text?.trim());
	}

	if (Array.isArray(message.parts)) {
		return message.parts.some((part) => part.type === "text" && part.text.trim());
	}

	return false;
}

function hasCachedRenderablePayloadMissingFromFetched(
	fetchedConversation: Conversation,
	cachedConversation: Conversation,
): boolean {
	return cachedConversation.messages.some((cachedMessage, index) => {
		const fetchedMessage = fetchedConversation.messages[index];
		if (cachedMessage.role !== fetchedMessage?.role) {
			return false;
		}

		return (
			(hasVisibleTextPayload(cachedMessage) && !hasVisibleTextPayload(fetchedMessage)) ||
			(hasRenderableMessagePayload(cachedMessage) && !hasRenderableMessagePayload(fetchedMessage))
		);
	});
}

export function preserveOptimisticMessages(
	fetchedConversation: Conversation | null | undefined,
	cachedConversation: Conversation | null | undefined,
): Conversation | null {
	if (!fetchedConversation || !cachedConversation?.messages?.length) {
		return fetchedConversation || cachedConversation || null;
	}

	const fetchedMessageCount = fetchedConversation.messages?.length || 0;
	const cachedMessageCount = cachedConversation.messages.length;

	if (
		cachedMessageCount < fetchedMessageCount ||
		(cachedMessageCount === fetchedMessageCount &&
			!hasCachedRenderablePayloadMissingFromFetched(fetchedConversation, cachedConversation))
	) {
		return fetchedConversation;
	}

	return {
		...fetchedConversation,
		...cachedConversation,
		is_public: fetchedConversation.is_public ?? cachedConversation.is_public,
		share_id: fetchedConversation.share_id ?? cachedConversation.share_id,
	};
}

export function isLocallyCreatedConversation(
	conversationId: string,
	locallyCreatedConversationIds: Record<string, true>,
): boolean {
	return locallyCreatedConversationIds[conversationId] === true;
}
