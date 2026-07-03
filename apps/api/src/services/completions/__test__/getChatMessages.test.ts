import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "~/lib/database";
import type { IUser } from "~/types";
import { handleGetChatMessages } from "../getChatMessages";
import type { GetChatMessagesContext } from "../getChatMessages";

vi.mock("~/lib/conversationManager", () => ({
	ConversationManager: {
		getInstance: vi.fn(),
	},
}));

const mockUser: IUser = {
	id: 123,
	name: "Test User",
	avatar_url: null,
	email: "test@example.com",
	github_username: null,
	company: null,
	site: null,
	location: null,
	bio: null,
	twitter_username: null,
	role: null,
	created_at: "2024-01-01T00:00:00.000Z",
	updated_at: "2024-01-01T00:00:00.000Z",
	setup_at: null,
	terms_accepted_at: null,
	plan_id: null,
};

let mockServiceContext: GetChatMessagesContext;

describe("handleGetChatMessages", () => {
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		const { ConversationManager } = await import("~/lib/conversationManager");

		mockConversationManager = {
			getVisibleMessages: vi.fn(),
		};

		mockServiceContext = {
			user: mockUser,
			ensureDatabase: vi.fn(),
			database: {} as Database,
		};

		vi.mocked(ConversationManager.getInstance).mockReturnValue(mockConversationManager);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("loads visible archived history for paginated chat messages", async () => {
		const messages = [
			{
				id: "compaction-1",
				role: "compaction",
				content: "Context compacted",
				parts: [{ type: "compaction", status: "completed", label: "Context compacted" }],
			},
			{
				id: "message-1",
				role: "user",
				content: "Visible message",
			},
		];

		mockConversationManager.getVisibleMessages.mockResolvedValue(messages);

		const result = await handleGetChatMessages(
			mockServiceContext,
			null,
			"conversation-1",
			20,
			"cursor-1",
		);

		expect(mockConversationManager.getVisibleMessages).toHaveBeenCalledWith(
			"conversation-1",
			20,
			"cursor-1",
			{
				includeArchived: true,
				includeSnapshots: false,
			},
		);
		expect(result).toEqual({
			messages,
			conversation_id: "conversation-1",
		});
	});
});
