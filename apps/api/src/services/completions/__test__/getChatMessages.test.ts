import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "~/lib/database";
import type { IUser } from "~/types";
import { handleGetChatMessageById, handleGetChatMessages } from "../getChatMessages";
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
const getByIdsForUser = vi.fn();

describe("handleGetChatMessages", () => {
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		const { ConversationManager } = await import("~/lib/conversationManager");

		mockConversationManager = {
			getMessageById: vi.fn(),
			getVisibleMessages: vi.fn(),
		};

		mockServiceContext = {
			user: mockUser,
			ensureDatabase: vi.fn(),
			database: {} as Database,
			repositories: {
				connectorOperationApprovals: { getByIdsForUser },
			},
		};
		getByIdsForUser.mockResolvedValue([]);

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

	it("returns the authoritative resolved approval state after a reload", async () => {
		const approvalMessage = {
			id: "approval-message",
			role: "tool",
			name: "use_recipe_connector",
			status: "pending",
			content: "Approval required",
			data: {
				approvalRequired: true,
				approvalId: "coa_action",
				provider: "googleslides",
				operation: "GOOGLESLIDES_CREATE_SLIDES_MARKDOWN",
				humanInTheLoop: {
					type: "approval",
					status: "pending",
					requires_user_action: true,
				},
			},
		};
		mockConversationManager.getVisibleMessages.mockResolvedValue([approvalMessage]);
		getByIdsForUser.mockResolvedValue([
			{
				id: "coa_action",
				state: "consumed",
				expiresAt: "2099-01-01T00:00:00.000Z",
				resolvedAt: "2026-08-13T14:00:00.000Z",
				consumedAt: "2026-08-13T14:00:05.000Z",
			},
		]);

		const result = await handleGetChatMessages(mockServiceContext, null, "conversation-1");

		expect(result.messages[0]?.data?.humanInTheLoop).toMatchObject({
			status: "consumed",
			requires_user_action: false,
			consumedAt: "2026-08-13T14:00:05.000Z",
		});
	});

	it("returns authoritative approval state for an individual message", async () => {
		mockConversationManager.getMessageById.mockResolvedValue({
			conversation_id: "conversation-1",
			message: {
				id: "approval-message",
				role: "tool",
				content: "Approval required",
				data: {
					approvalRequired: true,
					approvalId: "coa_action",
					provider: "googleslides",
					operation: "GOOGLESLIDES_CREATE_SLIDES_MARKDOWN",
				},
			},
		});
		getByIdsForUser.mockResolvedValue([
			{
				id: "coa_action",
				state: "rejected",
				expiresAt: "2099-01-01T00:00:00.000Z",
				resolvedAt: "2026-08-13T14:00:00.000Z",
				consumedAt: null,
			},
		]);

		const result = await handleGetChatMessageById(mockServiceContext, null, "approval-message");

		expect(result.message.data?.humanInTheLoop).toMatchObject({
			status: "rejected",
			requires_user_action: false,
		});
	});
});
