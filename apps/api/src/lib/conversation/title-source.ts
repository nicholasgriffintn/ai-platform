import { createConversationTitleExcerpt } from "@ngriffin_uk/polychat-schemas";

import type { Message } from "~/types";
import { MessageFormatter } from "~/lib/formatter/messages";
import { isCompactionMarkerMessage } from "~/lib/chat/messageParts";

export function createInitialConversationTitle(messages: Message[]): string {
	const sourceMessage = messages.find(
		(message) =>
			message.role === "user" &&
			!isCompactionMarkerMessage(message) &&
			MessageFormatter.stringifyMessageContent(message.content).trim(),
	);
	const sourceText = sourceMessage
		? MessageFormatter.stringifyMessageContent(sourceMessage.content)
		: "";

	return createConversationTitleExcerpt(sourceText);
}
