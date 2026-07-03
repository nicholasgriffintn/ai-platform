import { describe, expect, it, vi } from "vitest";

import { loadVisibleConversationMessagePage } from "../visibleMessagePagination";

interface RawMessage {
	id: string;
	content: string;
	hidden?: boolean;
}

function formatMessage(message: RawMessage) {
	return message;
}

function isHiddenMessage(message: RawMessage) {
	return message.hidden === true;
}

describe("loadVisibleConversationMessagePage", () => {
	it("fills a visible page when raw pages include hidden messages", async () => {
		const loadMessages = vi
			.fn()
			.mockResolvedValueOnce([
				{ id: "message-1", content: "Visible one" },
				{ id: "snapshot-1", content: "Hidden snapshot", hidden: true },
			])
			.mockResolvedValueOnce([{ id: "message-2", content: "Visible two" }]);

		const result = await loadVisibleConversationMessagePage({
			conversationId: "conversation-1",
			limit: 2,
			includeArchived: true,
			loadMessages,
			formatMessage,
			isHiddenMessage,
		});

		expect(loadMessages).toHaveBeenNthCalledWith(1, "conversation-1", 2, undefined, {
			includeArchived: true,
		});
		expect(loadMessages).toHaveBeenNthCalledWith(2, "conversation-1", 1, "snapshot-1", {
			includeArchived: true,
		});
		expect(result).toEqual([
			{ id: "message-1", content: "Visible one" },
			{ id: "message-2", content: "Visible two" },
		]);
	});

	it("fetches unbounded pages once and filters hidden messages", async () => {
		const loadMessages = vi.fn().mockResolvedValueOnce([
			{ id: "message-1", content: "Visible one" },
			{ id: "snapshot-1", content: "Hidden snapshot", hidden: true },
			{ id: "message-2", content: "Visible two" },
		]);

		const result = await loadVisibleConversationMessagePage({
			conversationId: "conversation-1",
			limit: 0,
			after: "cursor-1",
			includeArchived: false,
			loadMessages,
			formatMessage,
			isHiddenMessage,
		});

		expect(loadMessages).toHaveBeenCalledTimes(1);
		expect(loadMessages).toHaveBeenCalledWith("conversation-1", 0, "cursor-1", {
			includeArchived: false,
		});
		expect(result).toEqual([
			{ id: "message-1", content: "Visible one" },
			{ id: "message-2", content: "Visible two" },
		]);
	});

	it("stops when the raw cursor repeats", async () => {
		const repeatedHiddenMessage = {
			id: "snapshot-1",
			content: "Hidden snapshot",
			hidden: true,
		};
		const loadMessages = vi
			.fn()
			.mockResolvedValueOnce([repeatedHiddenMessage])
			.mockResolvedValueOnce([repeatedHiddenMessage]);

		const result = await loadVisibleConversationMessagePage({
			conversationId: "conversation-1",
			limit: 1,
			includeArchived: true,
			loadMessages,
			formatMessage,
			isHiddenMessage,
		});

		expect(loadMessages).toHaveBeenCalledTimes(2);
		expect(result).toEqual([]);
	});
});
