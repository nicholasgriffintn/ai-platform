import { getMessageTextContent } from "~/lib/messages";
import type { Message } from "~/types";
import { isCompactionMarkerMessage } from "./compaction-status";

const DEFAULT_TITLE = "New Conversation";
const DEFAULT_TITLE_LENGTH = 30;

export function getConversationTitleSourceMessage(messages: Message[]): Message | undefined {
	return messages.find(
		(message) => !isCompactionMarkerMessage(message) && getMessageTextContent(message),
	);
}

export function createTemporaryConversationTitle(
	messages: Message[],
	maxLength = DEFAULT_TITLE_LENGTH,
): string {
	const sourceMessage = getConversationTitleSourceMessage(messages);
	const titleText = sourceMessage ? getMessageTextContent(sourceMessage) : "";

	if (!titleText) {
		return DEFAULT_TITLE;
	}

	return `${titleText.slice(0, maxLength)}${titleText.length > maxLength ? "..." : ""}`;
}
