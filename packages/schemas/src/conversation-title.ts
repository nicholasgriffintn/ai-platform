export const DEFAULT_CONVERSATION_TITLE = "New Conversation";
export const DEFAULT_CONVERSATION_TITLE_LENGTH = 30;

export function createConversationTitleExcerpt(
	text: string,
	maxLength = DEFAULT_CONVERSATION_TITLE_LENGTH,
): string {
	const normalisedText = text.trim().replace(/\s+/g, " ");
	if (!normalisedText) {
		return DEFAULT_CONVERSATION_TITLE;
	}

	const characters = Array.from(normalisedText);
	if (characters.length <= maxLength) {
		return normalisedText;
	}

	return `${characters.slice(0, maxLength).join("")}...`;
}
