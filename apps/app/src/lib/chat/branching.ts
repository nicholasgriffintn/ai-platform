import type { Conversation, Message } from "~/types";
import { isCompactionMarkerMessage } from "./compaction-status";

export interface BranchPoint {
	message: Message;
	messages: Message[];
	shouldGenerateResponse: boolean;
}

export interface BranchConversationParams {
	conversation: Conversation;
	conversationId: string;
	isLocalOnly: boolean;
	messages: Message[];
	parentConversationId: string;
	parentMessageId: string;
}

export function canBranchFromMessage(message: Pick<Message, "id" | "role" | "parts">): boolean {
	return Boolean(
		message.id &&
		!isCompactionMarkerMessage(message) &&
		(message.role === "user" || message.role === "assistant"),
	);
}

export function getBranchPoint(messages: Message[], messageId: string): BranchPoint | null {
	const messageIndex = messages.findIndex((message) => message.id === messageId);
	if (messageIndex === -1) {
		return null;
	}

	const message = messages[messageIndex];
	if (!canBranchFromMessage(message)) {
		return null;
	}

	return {
		message,
		messages: messages.slice(0, messageIndex + 1),
		shouldGenerateResponse: message.role === "user",
	};
}

export function createBranchMetadata(parentConversationId: string, parentMessageId: string) {
	return {
		branch_of: JSON.stringify({
			conversation_id: parentConversationId,
			message_id: parentMessageId,
		}),
	};
}

export function createBranchConversation({
	conversation,
	conversationId,
	isLocalOnly,
	messages,
	parentConversationId,
	parentMessageId,
}: BranchConversationParams): Conversation {
	const now = new Date().toISOString();

	return {
		id: conversationId,
		title: conversation.title || "Branched Conversation",
		messages,
		parent_conversation_id: parentConversationId,
		parent_message_id: parentMessageId,
		isLocalOnly,
		created_at: now,
		updated_at: now,
		last_message_at: now,
	};
}
