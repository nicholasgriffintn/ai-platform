export const COMPACT_CONVERSATION_COMMAND = "/compact";

export function isCompactConversationCommand(input: string): boolean {
	return input.trim().toLowerCase() === COMPACT_CONVERSATION_COMMAND;
}
