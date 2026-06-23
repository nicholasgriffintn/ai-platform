import type {
	Conversation,
	ConversationArchiveFilter,
	ConversationListOptions,
	ConversationSortBy,
} from "~/types";

function getConversationDate(conversation: Conversation, sortBy: ConversationSortBy): number {
	const value =
		sortBy === "created"
			? conversation.created_at
			: conversation.updated_at || conversation.last_message_at;

	return value ? new Date(value).getTime() : 0;
}

export function filterConversationsByListOptions(
	conversations: Conversation[],
	options: ConversationListOptions = {},
): Conversation[] {
	const archiveFilter: ConversationArchiveFilter = options.archived ?? "active";
	const query = options.query?.trim().toLowerCase();
	const sortBy = options.sortBy ?? "updated";

	return conversations
		.filter((conversation) => {
			if (archiveFilter === "active" && conversation.is_archived) return false;
			if (archiveFilter === "archived" && !conversation.is_archived) return false;
			if (!query) return true;

			return (conversation.title || "New conversation").toLowerCase().includes(query);
		})
		.sort((a, b) => getConversationDate(b, sortBy) - getConversationDate(a, sortBy));
}
