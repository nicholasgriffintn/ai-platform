import type { Message } from "~/types";
import { generateId } from "~/utils/id";

export interface BranchedMessage extends Message {
	parent_message_id?: string;
}

export function cloneMessagesForBranch(messages: Message[]): BranchedMessage[] {
	return messages.map((message) => ({
		...message,
		id: generateId(),
		parent_message_id: message.id,
	}));
}
