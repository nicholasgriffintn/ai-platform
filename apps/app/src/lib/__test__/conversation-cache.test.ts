import type { InfiniteData } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { CHATS_QUERY_KEY } from "~/constants";
import type { Conversation, ConversationListPage } from "~/types";
import {
	updateConversationInChatCaches,
	upsertConversationInChatCaches,
} from "../conversation-cache";

function conversation(id: string, title: string): Conversation {
	return {
		id,
		title,
		messages: [],
		created_at: "2026-06-28T20:00:00.000Z",
		updated_at: "2026-06-28T20:00:00.000Z",
		last_message_at: "2026-06-28T20:00:00.000Z",
	};
}

function remotePages(conversations: Conversation[]): InfiniteData<ConversationListPage> {
	return {
		pageParams: [1],
		pages: [
			{
				conversations,
				pageNumber: 1,
				pageSize: 30,
				totalPages: 1,
			},
		],
	};
}

describe("conversation cache helpers", () => {
	it("upserts remote conversations into loaded sidebar infinite queries", () => {
		const queryClient = new QueryClient();
		const remoteQueryKey = [
			CHATS_QUERY_KEY,
			"remote",
			{ archived: "active", limit: 30, sortBy: "updated" },
		];
		const existingConversation = conversation("existing", "Existing");
		const newConversation = conversation("new", "New Conversation");

		queryClient.setQueryData(remoteQueryKey, remotePages([existingConversation]));

		upsertConversationInChatCaches(queryClient, newConversation, {
			includeLocalList: false,
			includeRemoteLists: true,
		});

		const remoteData = queryClient.getQueryData<InfiniteData<ConversationListPage>>(remoteQueryKey);

		expect(remoteData?.pages[0].conversations.map((chat) => chat.id)).toEqual(["new", "existing"]);
	});

	it("updates generated titles in loaded sidebar infinite queries", () => {
		const queryClient = new QueryClient();
		const remoteQueryKey = [
			CHATS_QUERY_KEY,
			"remote",
			{ archived: "active", limit: 30, sortBy: "updated" },
		];
		const newConversation = conversation("new", "New Conversation");

		queryClient.setQueryData(remoteQueryKey, remotePages([newConversation]));

		updateConversationInChatCaches(queryClient, "new", (chat) => ({
			...chat,
			title: "Robots Demand Coffee Breaks",
		}));

		const remoteData = queryClient.getQueryData<InfiniteData<ConversationListPage>>(remoteQueryKey);

		expect(remoteData?.pages[0].conversations[0].title).toBe("Robots Demand Coffee Breaks");
	});
});
