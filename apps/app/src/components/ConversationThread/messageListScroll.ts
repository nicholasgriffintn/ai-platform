interface MessageListScrollMessage {
	id: string;
}

interface MessageListScrollKeyInput {
	conversationId?: string;
	messages: MessageListScrollMessage[];
}

export function getMessageListScrollKey({
	conversationId,
	messages,
}: MessageListScrollKeyInput): string {
	const conversationKey = conversationId ?? "new";
	const lastMessage = messages[messages.length - 1];
	if (!lastMessage) {
		return `${conversationKey}:empty`;
	}

	return `${conversationKey}:${messages.length}:${lastMessage.id}`;
}
