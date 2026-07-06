import { readCompactionStatusMessage } from "~/lib/chat/compaction-status";
import { isRecord } from "~/lib/objects";

export interface CompactConversationResponse {
	compacted: boolean;
	conversation: {
		messages: unknown[];
		[key: string]: unknown;
	};
}

export function parseCompactConversationResponse(
	value: unknown,
): CompactConversationResponse | null {
	if (!isRecord(value) || typeof value.compacted !== "boolean" || !isRecord(value.conversation)) {
		return null;
	}

	const messages = value.conversation.messages;
	if (!Array.isArray(messages)) {
		return null;
	}

	if (value.compacted && !messages.some((message) => readCompactionStatusMessage(message))) {
		return null;
	}

	return {
		compacted: value.compacted,
		conversation: {
			...value.conversation,
			messages,
		},
	};
}
