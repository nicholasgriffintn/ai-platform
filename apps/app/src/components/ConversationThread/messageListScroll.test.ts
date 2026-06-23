import { describe, expect, it } from "vitest";

import { getMessageListScrollKey } from "./messageListScroll";

describe("getMessageListScrollKey", () => {
	it("ignores streamed content changes for the current assistant message", () => {
		const firstKey = getMessageListScrollKey({
			conversationId: "conversation-1",
			messages: [{ id: "user-1" }, { id: "assistant-1" }],
		});
		const streamedUpdateKey = getMessageListScrollKey({
			conversationId: "conversation-1",
			messages: [{ id: "user-1" }, { id: "assistant-1" }],
		});

		expect(streamedUpdateKey).toBe(firstKey);
	});

	it("changes when the conversation or last message changes", () => {
		const currentConversationKey = getMessageListScrollKey({
			conversationId: "conversation-1",
			messages: [{ id: "message-1" }],
		});

		expect(
			getMessageListScrollKey({
				conversationId: "conversation-2",
				messages: [{ id: "message-1" }],
			}),
		).not.toBe(currentConversationKey);
		expect(
			getMessageListScrollKey({
				conversationId: "conversation-1",
				messages: [{ id: "message-1" }, { id: "message-2" }],
			}),
		).not.toBe(currentConversationKey);
	});
});
