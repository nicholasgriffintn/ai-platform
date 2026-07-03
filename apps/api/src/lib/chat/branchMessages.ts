import type { Message } from "~/types";
import { generateId } from "~/utils/id";

export interface BranchedMessage extends Message {
	parent_message_id?: string;
}

export interface BranchSourceMessagesInput {
	parentActiveMessages?: Message[];
	parentMessageId: string;
	providedMessages: Message[];
}

export function selectBranchSourceMessages({
	parentActiveMessages,
	parentMessageId,
	providedMessages,
}: BranchSourceMessagesInput): Message[] {
	if (!parentActiveMessages?.length) {
		return providedMessages;
	}

	const parentMessageIndex = parentActiveMessages.findIndex(
		(message) => message.id === parentMessageId,
	);

	if (parentMessageIndex === -1) {
		return providedMessages;
	}

	return parentActiveMessages.slice(0, parentMessageIndex + 1);
}

export function cloneMessagesForBranch(
	messages: Message[],
	completionId: string,
): BranchedMessage[] {
	return messages.map((message) => ({
		...message,
		id: generateId(),
		completion_id: completionId,
		parent_message_id: message.id,
	}));
}
