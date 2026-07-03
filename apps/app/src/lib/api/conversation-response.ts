import type { Conversation } from "~/types";
import { normalizeMessage } from "../messages";

type ConversationResponse = Omit<Partial<Conversation>, "messages"> & {
	id?: unknown;
	messages?: unknown;
	title?: unknown;
};

export function normaliseConversationResponse(
	conversation: ConversationResponse | null | undefined,
	fallbackId: string,
	fallbackTitle = "New conversation",
): Conversation {
	if (!conversation) {
		return {
			id: fallbackId,
			title: fallbackTitle,
			messages: [],
		};
	}

	return {
		...conversation,
		id: typeof conversation.id === "string" ? conversation.id : fallbackId,
		title: typeof conversation.title === "string" ? conversation.title : fallbackTitle,
		messages: Array.isArray(conversation.messages)
			? conversation.messages.map((message) => normalizeMessage(message))
			: [],
	};
}
