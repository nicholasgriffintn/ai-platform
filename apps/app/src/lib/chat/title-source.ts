import { createConversationTitleExcerpt } from "@ngriffin_uk/polychat-schemas";

import { getMessageTextContent } from "~/lib/messages";
import type { Message } from "~/types";
import { isCompactionMarkerMessage } from "./compaction-status";

export function getConversationTitleSourceMessage(messages: Message[]): Message | undefined {
	return messages.find(
		(message) =>
			message.role === "user" &&
			!isCompactionMarkerMessage(message) &&
			getMessageTextContent(message),
	);
}

export function createTemporaryConversationTitle(messages: Message[], maxLength?: number): string {
	const sourceMessage = getConversationTitleSourceMessage(messages);
	const titleText = sourceMessage ? getMessageTextContent(sourceMessage) : "";

	return createConversationTitleExcerpt(titleText, maxLength);
}
