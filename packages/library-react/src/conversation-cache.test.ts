import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { upsertConversationInChatCaches } from "./conversation-cache";

describe("conversation cache", () => {
	it("creates and updates only the active scoped local conversation list", () => {
		const queryClient = new QueryClient();
		queryClient.setQueryData(
			["chats", "local", "user:7"],
			[{ id: "other-conversation", title: "Other user conversation" }],
		);

		upsertConversationInChatCaches(
			queryClient,
			{ id: "conversation-1", title: "Scoped conversation" },
			{ includeLocalList: true, includeRemoteLists: false, localScope: "user:42" },
		);

		expect(queryClient.getQueryData(["chats", "local", "user:42"])).toEqual([
			{ id: "conversation-1", title: "Scoped conversation" },
		]);
		expect(queryClient.getQueryData(["chats", "local", "user:7"])).toEqual([
			{ id: "other-conversation", title: "Other user conversation" },
		]);
	});
});
