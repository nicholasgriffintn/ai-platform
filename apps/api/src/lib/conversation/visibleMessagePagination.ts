export interface VisibleConversationMessagePagination<RawMessage, Message> {
	conversationId: string;
	limit: number;
	after?: string;
	includeArchived: boolean;
	loadMessages: (
		conversationId: string,
		limit: number,
		after: string | undefined,
		options: { includeArchived: boolean },
	) => Promise<RawMessage[]>;
	formatMessage: (message: RawMessage) => Message;
	isHiddenMessage: (message: Message) => boolean;
}

export async function loadVisibleConversationMessagePage<
	RawMessage extends { id?: unknown },
	Message,
>(options: VisibleConversationMessagePagination<RawMessage, Message>): Promise<Message[]> {
	const {
		conversationId,
		limit,
		after,
		includeArchived,
		loadMessages,
		formatMessage,
		isHiddenMessage,
	} = options;

	if (limit <= 0) {
		const rawMessages = await loadMessages(conversationId, limit, after, { includeArchived });
		return rawMessages.map(formatMessage).filter((message) => !isHiddenMessage(message));
	}

	const visibleMessages: Message[] = [];
	const seenCursors = new Set<string>();
	let cursor = after;

	while (visibleMessages.length < limit) {
		const remaining = limit - visibleMessages.length;
		const rawMessages = await loadMessages(conversationId, remaining, cursor, {
			includeArchived,
		});

		if (rawMessages.length === 0) {
			break;
		}

		for (const rawMessage of rawMessages) {
			const message = formatMessage(rawMessage);
			if (!isHiddenMessage(message)) {
				visibleMessages.push(message);
			}
		}

		const nextCursor = rawMessages.at(-1)?.id;
		if (typeof nextCursor !== "string" || seenCursors.has(nextCursor)) {
			break;
		}

		seenCursors.add(nextCursor);
		cursor = nextCursor;

		if (rawMessages.length < remaining) {
			break;
		}
	}

	return visibleMessages;
}
