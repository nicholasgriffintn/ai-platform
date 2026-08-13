import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import {
	filterConversationsByListOptions,
	type ConversationListOptions,
	type ConversationSummary,
} from "@ngriffin_uk/polychat-library-chat/conversations";

const DEFAULT_CHATS_QUERY_KEY = "chats";

export interface ConversationListPage<T extends ConversationSummary> {
	conversations: T[];
	pageNumber: number;
	pageSize: number;
	totalPages: number;
}

type ConversationListUpdater<T> = (conversation: T) => T;

function getRemoteListOptions(queryKey: QueryKey): ConversationListOptions {
	const [, , options] = Array.isArray(queryKey) ? queryKey : [];
	if (!options || typeof options !== "object") return {};
	const { archived, query, sortBy } = options as Record<string, unknown>;
	return {
		archived:
			archived === "active" || archived === "archived" || archived === "all" ? archived : undefined,
		query: typeof query === "string" ? query : undefined,
		sortBy: sortBy === "updated" || sortBy === "created" ? sortBy : undefined,
	};
}

function updateRemoteConversationLists<T extends ConversationSummary>(
	queryClient: QueryClient,
	queryKeyRoot: string,
	updater: (
		oldData: InfiniteData<ConversationListPage<T>> | undefined,
		queryKey: QueryKey,
	) => InfiniteData<ConversationListPage<T>> | undefined,
) {
	const remoteQueries = queryClient.getQueryCache().findAll({ queryKey: [queryKeyRoot, "remote"] });
	for (const query of remoteQueries) {
		queryClient.setQueryData<InfiniteData<ConversationListPage<T>>>(query.queryKey, (oldData) =>
			updater(oldData, query.queryKey),
		);
	}
}

export function upsertConversationInChatCaches<T extends ConversationSummary>(
	queryClient: QueryClient,
	conversation: T,
	options: { includeLocalList: boolean; includeRemoteLists: boolean },
	queryKeyRoot = DEFAULT_CHATS_QUERY_KEY,
) {
	queryClient.setQueryData([queryKeyRoot, conversation.id], conversation);
	if (options.includeLocalList) {
		queryClient.setQueryData<T[]>([queryKeyRoot, "local"], (oldData = []) => [
			conversation,
			...oldData.filter((chat) => chat.id !== conversation.id),
		]);
	}
	if (!options.includeRemoteLists) return;

	updateRemoteConversationLists<T>(queryClient, queryKeyRoot, (data, queryKey) => {
		if (!data?.pages.length) return data;
		const pages = data.pages.map((page) => ({
			...page,
			conversations: page.conversations.filter((chat) => chat.id !== conversation.id),
		}));
		if (filterConversationsByListOptions([conversation], getRemoteListOptions(queryKey)).length) {
			pages[0] = { ...pages[0], conversations: [conversation, ...pages[0].conversations] };
		}
		return { ...data, pages };
	});
}

export function updateConversationInChatCaches<T extends ConversationSummary>(
	queryClient: QueryClient,
	conversationId: string,
	updater: ConversationListUpdater<T>,
	queryKeyRoot = DEFAULT_CHATS_QUERY_KEY,
) {
	queryClient.setQueryData<T>([queryKeyRoot, conversationId], (oldData) =>
		oldData ? updater(oldData) : oldData,
	);
	queryClient.setQueryData<T[]>([queryKeyRoot, "local"], (oldData = []) =>
		oldData.map((chat) => (chat.id === conversationId ? updater(chat) : chat)),
	);
	updateRemoteConversationLists<T>(queryClient, queryKeyRoot, (data) =>
		data?.pages.length
			? {
					...data,
					pages: data.pages.map((page) => ({
						...page,
						conversations: page.conversations.map((chat) =>
							chat.id === conversationId ? updater(chat) : chat,
						),
					})),
				}
			: data,
	);
}

export function removeConversationFromChatCaches<T extends ConversationSummary>(
	queryClient: QueryClient,
	conversationId: string,
	queryKeyRoot = DEFAULT_CHATS_QUERY_KEY,
) {
	queryClient.removeQueries({ queryKey: [queryKeyRoot, conversationId], exact: true });
	queryClient.setQueryData<T[]>([queryKeyRoot, "local"], (oldData) =>
		oldData?.filter((chat) => chat.id !== conversationId),
	);
	updateRemoteConversationLists<T>(queryClient, queryKeyRoot, (data) =>
		data?.pages.length
			? {
					...data,
					pages: data.pages.map((page) => ({
						...page,
						conversations: page.conversations.filter((chat) => chat.id !== conversationId),
					})),
				}
			: data,
	);
}
