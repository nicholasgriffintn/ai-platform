import type { Message } from "~/types";
import { fetchApiOrThrow, returnFetchedData } from "./fetch-wrapper";

const SHARED_CONVERSATION_PAGE_LIMIT = 100;
const MAX_SHARED_CONVERSATION_PAGES = 10_000;

export interface SharedConversationHistory {
	messages: Message[];
	share_id: string;
}

export async function fetchSharedConversationHistory(
	shareId: string,
): Promise<SharedConversationHistory> {
	const messages: Message[] = [];
	const seenMessageIds = new Set<string>();
	const seenCursors = new Set<string>();
	let after: string | undefined;
	let resolvedShareId = shareId;

	for (let page = 0; page < MAX_SHARED_CONVERSATION_PAGES; page++) {
		const params = new URLSearchParams({
			limit: String(SHARED_CONVERSATION_PAGE_LIMIT),
		});
		if (after) {
			params.set("after", after);
		}

		const response = await fetchApiOrThrow(
			`/chat/shared/${encodeURIComponent(shareId)}?${params.toString()}`,
		);
		const pageData = await returnFetchedData<SharedConversationHistory>(response);
		resolvedShareId = pageData.share_id;
		for (const message of pageData.messages) {
			if (message.id) {
				if (seenMessageIds.has(message.id)) {
					continue;
				}
				seenMessageIds.add(message.id);
			}
			messages.push(message);
		}

		if (pageData.messages.length < SHARED_CONVERSATION_PAGE_LIMIT) {
			break;
		}

		const nextCursor = pageData.messages.at(-1)?.id;
		if (!nextCursor || seenCursors.has(nextCursor)) {
			break;
		}
		seenCursors.add(nextCursor);
		after = nextCursor;
	}

	return {
		messages,
		share_id: resolvedShareId,
	};
}
