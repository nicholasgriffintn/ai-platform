import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";

import { CHATS_QUERY_KEY } from "~/constants";
import type { Conversation, ConversationListOptions, ConversationListPage } from "~/types";
import { filterConversationsByListOptions } from "./conversation-list";

type ConversationListUpdater = (conversation: Conversation) => Conversation;

function upsertConversation(conversations: Conversation[], conversation: Conversation) {
	const withoutConversation = conversations.filter((chat) => chat.id !== conversation.id);
	return [conversation, ...withoutConversation];
}

function updateConversation(
	conversations: Conversation[],
	conversationId: string,
	updater: ConversationListUpdater,
) {
	return conversations.map((chat) => (chat.id === conversationId ? updater(chat) : chat));
}

function getRemoteListOptions(queryKey: QueryKey): ConversationListOptions {
	const [, , options] = Array.isArray(queryKey) ? queryKey : [];
	return options && typeof options === "object" ? (options as ConversationListOptions) : {};
}

function isVisibleInList(conversation: Conversation, options: ConversationListOptions) {
	return filterConversationsByListOptions([conversation], options).length > 0;
}

function upsertInfiniteConversation(
	data: InfiniteData<ConversationListPage> | undefined,
	conversation: Conversation,
	options: ConversationListOptions,
) {
	if (!data?.pages.length) {
		return data;
	}

	const pages = data.pages.map((page) => ({
		...page,
		conversations: page.conversations.filter((chat) => chat.id !== conversation.id),
	}));

	if (isVisibleInList(conversation, options)) {
		pages[0] = {
			...pages[0],
			conversations: upsertConversation(pages[0].conversations, conversation),
		};
	}

	return { ...data, pages };
}

function updateInfiniteConversation(
	data: InfiniteData<ConversationListPage> | undefined,
	conversationId: string,
	updater: ConversationListUpdater,
) {
	if (!data?.pages.length) {
		return data;
	}

	return {
		...data,
		pages: data.pages.map((page) => ({
			...page,
			conversations: updateConversation(page.conversations, conversationId, updater),
		})),
	};
}

function updateRemoteConversationLists(
	queryClient: QueryClient,
	updater: (
		oldData: InfiniteData<ConversationListPage> | undefined,
		queryKey: QueryKey,
	) => InfiniteData<ConversationListPage> | undefined,
) {
	const remoteQueries = queryClient
		.getQueryCache()
		.findAll({ queryKey: [CHATS_QUERY_KEY, "remote"] });

	for (const query of remoteQueries) {
		queryClient.setQueryData<InfiniteData<ConversationListPage>>(query.queryKey, (oldData) =>
			updater(oldData, query.queryKey),
		);
	}
}

export function upsertConversationInChatCaches(
	queryClient: QueryClient,
	conversation: Conversation,
	options: { includeLocalList: boolean; includeRemoteLists: boolean },
) {
	queryClient.setQueryData([CHATS_QUERY_KEY, conversation.id], conversation);

	queryClient.setQueryData<Conversation[]>([CHATS_QUERY_KEY], (oldData = []) =>
		upsertConversation(oldData, conversation),
	);

	if (options.includeLocalList) {
		queryClient.setQueryData<Conversation[]>([CHATS_QUERY_KEY, "local"], (oldData = []) =>
			upsertConversation(oldData, conversation),
		);
	}

	if (options.includeRemoteLists) {
		updateRemoteConversationLists(queryClient, (oldData, queryKey) =>
			upsertInfiniteConversation(oldData, conversation, getRemoteListOptions(queryKey)),
		);
	}
}

export function updateConversationInChatCaches(
	queryClient: QueryClient,
	conversationId: string,
	updater: ConversationListUpdater,
) {
	queryClient.setQueryData<Conversation>([CHATS_QUERY_KEY, conversationId], (oldData) =>
		oldData ? updater(oldData) : oldData,
	);

	queryClient.setQueryData<Conversation[]>([CHATS_QUERY_KEY], (oldData = []) =>
		updateConversation(oldData, conversationId, updater),
	);

	queryClient.setQueryData<Conversation[]>([CHATS_QUERY_KEY, "local"], (oldData = []) =>
		updateConversation(oldData, conversationId, updater),
	);

	updateRemoteConversationLists(queryClient, (oldData) =>
		updateInfiniteConversation(oldData, conversationId, updater),
	);
}
