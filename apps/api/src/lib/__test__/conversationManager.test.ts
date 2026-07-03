import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationManager } from "../conversationManager";

const mockDatabase = {
	getConversation: vi.fn(),
	createConversation: vi.fn(),
	createMessage: vi.fn(),
	upsertMessage: vi.fn(),
	archiveMessages: vi.fn(),
	deleteMessage: vi.fn(),
	deleteMessages: vi.fn(),
	deleteMessagesExcept: vi.fn(),
	getConversationMessageMetadata: vi.fn(),
	updateConversationAfterMessage: vi.fn(),
	getConversationMessages: vi.fn(),
	updateMessage: vi.fn(),
	getUserConversations: vi.fn(),
	updateConversation: vi.fn(),
	getMessageById: vi.fn(),
	getConversationByShareId: vi.fn(),
	getMessages: vi.fn(),
	deleteAllChatCompletions: vi.fn(),
	repositories: {
		conversations: {
			getConversation: vi.fn(),
			createConversation: vi.fn(),
			updateConversationAfterMessage: vi.fn(),
			getUserConversations: vi.fn(),
			updateConversation: vi.fn(),
			getConversationByShareId: vi.fn(),
			deleteAllChatCompletions: vi.fn(),
		},
		messages: {
			createMessage: vi.fn(),
			upsertMessage: vi.fn(),
			archiveMessages: vi.fn(),
			deleteMessage: vi.fn(),
			deleteMessages: vi.fn(),
			deleteMessagesExcept: vi.fn(),
			getConversationMessageMetadata: vi.fn(),
			getConversationMessages: vi.fn(),
			updateMessage: vi.fn(),
			getMessageById: vi.fn(),
			getMessages: vi.fn(),
		},
	},
};

const mockUsageManager = {
	getUsageLimits: vi.fn(),
	checkUsageByModel: vi.fn(),
	incrementUsageByModel: vi.fn(),
	incrementFunctionUsage: vi.fn(),
};

vi.mock("./usageManager", () => ({
	UsageManager: vi.fn().mockImplementation(() => mockUsageManager),
}));

describe("ConversationManager", () => {
	const mockUser = {
		id: 1,
		email: "test@example.com",
		plan_id: "free",
	} as any;

	beforeEach(() => {
		vi.clearAllMocks();
		ConversationManager["instance"] = undefined as any;

		// Link old methods to new repository structure for backwards compatibility
		mockDatabase.repositories.conversations.getConversation.mockImplementation((...args) =>
			mockDatabase.getConversation(...args),
		);
		mockDatabase.repositories.conversations.createConversation.mockImplementation((...args) =>
			mockDatabase.createConversation(...args),
		);
		mockDatabase.repositories.conversations.updateConversationAfterMessage.mockImplementation(
			(...args) => mockDatabase.updateConversationAfterMessage(...args),
		);
		mockDatabase.repositories.conversations.getUserConversations.mockImplementation((...args) =>
			mockDatabase.getUserConversations(...args),
		);
		mockDatabase.repositories.conversations.updateConversation.mockImplementation((...args) =>
			mockDatabase.updateConversation(...args),
		);
		mockDatabase.repositories.conversations.getConversationByShareId.mockImplementation((...args) =>
			mockDatabase.getConversationByShareId(...args),
		);
		mockDatabase.repositories.conversations.deleteAllChatCompletions.mockImplementation((...args) =>
			mockDatabase.deleteAllChatCompletions(...args),
		);

		mockDatabase.repositories.messages.createMessage.mockImplementation((...args) =>
			mockDatabase.createMessage(...args),
		);
		mockDatabase.repositories.messages.upsertMessage.mockImplementation((...args) =>
			mockDatabase.upsertMessage(...args),
		);
		mockDatabase.repositories.messages.archiveMessages.mockImplementation((...args) =>
			mockDatabase.archiveMessages(...args),
		);
		mockDatabase.repositories.messages.deleteMessage.mockImplementation((...args) =>
			mockDatabase.deleteMessage(...args),
		);
		mockDatabase.repositories.messages.deleteMessages.mockImplementation((...args) =>
			mockDatabase.deleteMessages(...args),
		);
		mockDatabase.repositories.messages.deleteMessagesExcept.mockImplementation((...args) =>
			mockDatabase.deleteMessagesExcept(...args),
		);
		mockDatabase.repositories.messages.getConversationMessageMetadata.mockImplementation(
			(...args) => mockDatabase.getConversationMessageMetadata(...args),
		);
		mockDatabase.repositories.messages.getConversationMessages.mockImplementation((...args) =>
			mockDatabase.getConversationMessages(...args),
		);
		mockDatabase.repositories.messages.updateMessage.mockImplementation((...args) =>
			mockDatabase.updateMessage(...args),
		);
		mockDatabase.repositories.messages.getMessageById.mockImplementation((...args) =>
			mockDatabase.getMessageById(...args),
		);
		mockDatabase.repositories.messages.getMessages.mockImplementation((...args) =>
			mockDatabase.getMessages(...args),
		);
		mockDatabase.upsertMessage.mockImplementation(async (messageId) => ({ id: messageId }));
		mockDatabase.archiveMessages.mockResolvedValue(undefined);
		mockDatabase.deleteMessage.mockResolvedValue(undefined);
		mockDatabase.deleteMessages.mockResolvedValue(undefined);
		mockDatabase.deleteMessagesExcept.mockResolvedValue(undefined);
		mockDatabase.getConversationMessageMetadata.mockResolvedValue({
			last_message_id: null,
			message_count: 0,
		});
	});

	describe("getInstance", () => {
		it("should create new instance", () => {
			const instance1 = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			const instance2 = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			expect(instance1).toStrictEqual(instance2);
		});

		it("should create instance with different user properties", () => {
			const instance1 = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			const newUser = { ...mockUser, id: 2 };
			const instance2 = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: newUser,
			});

			expect(instance1).not.toBe(instance2);
			expect(instance2["user"]).toEqual(newUser);
		});
	});

	describe("getUsageLimits", () => {
		it("should return usage limits from usage manager", async () => {
			const mockLimits = { daily: { used: 5, limit: 25 } };
			mockUsageManager.getUsageLimits.mockResolvedValue(mockLimits);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser as any,
			});
			manager["usageManager"] = mockUsageManager as any;

			const result = await manager.getUsageLimits();

			expect(result).toEqual(mockLimits);
			expect(mockUsageManager.getUsageLimits).toHaveBeenCalledWith();
		});

		it("should return null when usage manager fails", async () => {
			mockUsageManager.getUsageLimits.mockRejectedValue(new Error("Database error"));

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser as any,
			});
			manager["usageManager"] = mockUsageManager as any;

			const result = await manager.getUsageLimits();

			expect(result).toBeNull();
		});

		it("should return null when no usage manager is set", async () => {
			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser as any,
			});
			manager["usageManager"] = undefined;

			const result = await manager.getUsageLimits();

			expect(result).toBeNull();
		});
	});

	describe("checkUsageLimits", () => {
		it("should check usage limits for authenticated user", async () => {
			mockUsageManager.checkUsageByModel.mockResolvedValue(undefined);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser as any,
				model: "gpt-4",
			});
			manager["usageManager"] = mockUsageManager as any;

			await manager.checkUsageLimits();

			expect(mockUsageManager.checkUsageByModel).toHaveBeenCalledWith("gpt-4", false);
		});

		it("should not check usage when no user is set", async () => {
			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
			});

			await manager.checkUsageLimits();

			expect(mockUsageManager.checkUsageByModel).not.toHaveBeenCalled();
		});
	});

	describe("add", () => {
		it("should add single message to conversation", async () => {
			const conversationId = "conv-123";
			const message = {
				role: "user",
				content: "Hello",
			} as any;

			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.createMessage.mockResolvedValue(undefined);
			mockDatabase.updateConversationAfterMessage.mockResolvedValue(undefined);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			const result = await manager.add(conversationId, message);

			expect(result).toEqual(
				expect.objectContaining({
					role: "user",
					content: "Hello",
					id: expect.any(String),
					timestamp: expect.any(Number),
				}),
			);
			expect(mockDatabase.createMessage).toHaveBeenCalled();
		});

		it("stores ordinary object content as visible text parts", async () => {
			const conversationId = "conv-object-content";
			const message = {
				id: "object-message",
				role: "user",
				content: {
					answer: "Visible structured response",
				},
			} as any;

			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.createMessage.mockResolvedValue(undefined);
			mockDatabase.updateConversationAfterMessage.mockResolvedValue(undefined);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			await manager.add(conversationId, message);

			expect(mockDatabase.createMessage).toHaveBeenCalledWith(
				"object-message",
				conversationId,
				"user",
				'{"answer":"Visible structured response"}',
				expect.objectContaining({
					parts: [
						expect.objectContaining({
							type: "text",
							text: '{"answer":"Visible structured response"}',
						}),
					],
				}),
			);
		});

		it("should keep batch storage order stable when message timestamps arrive out of order", async () => {
			const conversationId = "conv-live";
			const messages = [
				{
					id: "user-message",
					role: "user",
					content: "What car would you drive?",
					timestamp: 2000,
				},
				{
					id: "assistant-message",
					role: "assistant",
					content: "Small and efficient.",
					timestamp: 1000,
				},
			] as any[];

			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.createMessage.mockResolvedValue(undefined);
			mockDatabase.updateConversationAfterMessage.mockResolvedValue(undefined);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			await manager.addBatch(conversationId, messages);

			expect(
				mockDatabase.createMessage.mock.calls.map(([messageId, , role, , messageData]) => ({
					id: messageId,
					role,
					timestamp: messageData.timestamp,
				})),
			).toEqual([
				{
					id: "user-message",
					role: "user",
					timestamp: 2000,
				},
				{
					id: "assistant-message",
					role: "assistant",
					timestamp: 2001,
				},
			]);
		});

		it("increments usage for stored assistant responses", async () => {
			const conversationId = "conv-usage";
			const message = {
				id: "assistant-message",
				role: "assistant",
				content: "Stored assistant response",
			} as any;

			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.createMessage.mockResolvedValue(undefined);
			mockDatabase.updateConversationAfterMessage.mockResolvedValue(undefined);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
				model: "gpt-4",
			});
			manager["usageManager"] = mockUsageManager as any;

			await manager.add(conversationId, message);

			expect(mockUsageManager.incrementUsageByModel).toHaveBeenCalledWith("gpt-4", true);
		});

		it("does not increment assistant usage for stored compaction snapshots", async () => {
			const conversationId = "conv-snapshot";
			const snapshotMessage = {
				id: "snapshot-message",
				role: "assistant",
				content: "Conversation snapshot\n\nEarlier context summary.",
				parts: [
					{
						type: "snapshot",
						title: "Conversation snapshot",
						summary: "Earlier context summary.",
					},
					{
						type: "text",
						text: "Conversation snapshot\n\nEarlier context summary.",
					},
				],
			} as any;

			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.createMessage.mockResolvedValue(undefined);
			mockDatabase.updateConversationAfterMessage.mockResolvedValue(undefined);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
				model: "gpt-4",
			});
			manager["usageManager"] = mockUsageManager as any;

			await manager.add(conversationId, snapshotMessage);

			expect(mockDatabase.createMessage).toHaveBeenCalled();
			expect(mockUsageManager.incrementUsageByModel).not.toHaveBeenCalled();
		});

		it("should create conversation if it doesn't exist", async () => {
			const conversationId = "conv-new";
			const message = {
				role: "user",
				content: "Hello",
			} as any;

			mockDatabase.getConversation.mockResolvedValue(null);
			mockDatabase.createConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.createMessage.mockResolvedValue(undefined);
			mockDatabase.updateConversationAfterMessage.mockResolvedValue(undefined);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			await manager.add(conversationId, message);

			expect(mockDatabase.createConversation).toHaveBeenCalledWith(
				conversationId,
				mockUser.id,
				"New Conversation",
				{
					parent_conversation_id: undefined,
					parent_message_id: undefined,
				},
			);
		});

		it("should create branched conversation metadata when provided", async () => {
			const conversationId = "conv-branch";
			const message = {
				role: "assistant",
				content: "Hello",
			} as any;

			mockDatabase.getConversation.mockResolvedValue(null);
			mockDatabase.createConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
				parent_conversation_id: "conv-parent",
				parent_message_id: "message-parent",
			});
			mockDatabase.createMessage.mockResolvedValue(undefined);
			mockDatabase.updateConversationAfterMessage.mockResolvedValue(undefined);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			await manager.replaceMessages(conversationId, [message], {
				metadata: {
					branch_of: JSON.stringify({
						conversation_id: "conv-parent",
						message_id: "message-parent",
					}),
				},
			});

			expect(mockDatabase.createConversation).toHaveBeenCalledWith(
				conversationId,
				mockUser.id,
				"New Conversation",
				{
					parent_conversation_id: "conv-parent",
					parent_message_id: "message-parent",
				},
			);
		});

		it("should replace messages with same-conversation upserts", async () => {
			const conversationId = "conv-replace";
			const messages = [
				{
					id: "message-1",
					role: "user",
					content: "Original",
					timestamp: 1000,
				},
				{
					id: "message-1",
					role: "user",
					content: "Updated",
					timestamp: 1001,
				},
				{
					id: "message-2",
					role: "assistant",
					content: "Answer",
					timestamp: 1002,
				},
			] as any[];

			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.updateConversation.mockResolvedValue(undefined);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			await manager.replaceMessages(conversationId, messages);

			expect(mockDatabase.deleteMessagesExcept).toHaveBeenCalledWith(conversationId, [
				"message-1",
				"message-2",
			]);
			expect(mockDatabase.createMessage).not.toHaveBeenCalled();
			expect(mockDatabase.upsertMessage).toHaveBeenCalledTimes(2);
			expect(mockDatabase.upsertMessage.mock.calls[0][0]).toBe("message-1");
			expect(mockDatabase.upsertMessage.mock.calls[0][3]).toBe("Updated");
			expect(mockDatabase.updateConversation).toHaveBeenCalledWith(
				conversationId,
				expect.objectContaining({
					last_message_id: "message-2",
					last_message_at: expect.any(String),
					message_count: 2,
				}),
			);
		});

		it("should throw error when no user ID for storage", async () => {
			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: null,
			});

			await expect(
				manager.add("conv-123", { role: "user", content: "Hello" } as any),
			).rejects.toThrow("User ID is required to store conversations");
		});

		it("should throw error when user doesn't own conversation", async () => {
			const conversationId = "conv-123";
			const message = { role: "user", content: "Hello" } as any;

			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: 999,
			});

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			await expect(manager.add(conversationId, message)).rejects.toThrow(
				"You don't have permission to update this conversation",
			);
		});
	});

	describe("get", () => {
		it("should get messages from conversation", async () => {
			const conversationId = "conv-123";
			const mockMessages = [
				{
					id: "msg-1",
					role: "user",
					content: "Hello",
					timestamp: Date.now(),
				},
			];

			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.getConversationMessages.mockResolvedValue(mockMessages);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			const result = await manager.get(conversationId);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual(
				expect.objectContaining({
					id: "msg-1",
					role: "user",
					content: "Hello",
				}),
			);
		});

		it("should throw error when conversation not found", async () => {
			mockDatabase.getConversation.mockResolvedValue(null);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			await expect(manager.get("nonexistent")).rejects.toThrow("Conversation not found");
		});

		it("should return single message when no store", async () => {
			const message = { role: "user", content: "Hello" } as any;

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
				store: false,
			});

			const result = await manager.get("conv-123", message);

			expect(result).toEqual([message]);
		});
	});

	describe("updateConversation", () => {
		it("should update conversation title", async () => {
			const conversationId = "conv-123";
			const updates = { title: "New Title" };

			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.updateConversation.mockResolvedValue(undefined);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			await manager.updateConversation(conversationId, updates);

			expect(mockDatabase.updateConversation).toHaveBeenCalledWith(conversationId, {
				title: "New Title",
			});
		});

		it("should update conversation archived status", async () => {
			const conversationId = "conv-123";
			const updates = { archived: true };

			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.updateConversation.mockResolvedValue(undefined);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			await manager.updateConversation(conversationId, updates);

			expect(mockDatabase.updateConversation).toHaveBeenCalledWith(conversationId, {
				is_archived: true,
			});
		});

		it("should archive messages after checking conversation ownership and refresh metadata", async () => {
			const conversationId = "conv-123";
			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.getConversationMessageMetadata.mockResolvedValue({
				last_message_id: "snapshot-1",
				message_count: 1,
			});

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			await manager.archiveMessages(conversationId, ["old-message", "compaction-marker"]);

			expect(mockDatabase.archiveMessages).toHaveBeenCalledWith(conversationId, [
				"old-message",
				"compaction-marker",
			]);
			expect(mockDatabase.getConversationMessageMetadata).toHaveBeenCalledWith(conversationId);
			expect(mockDatabase.updateConversation).toHaveBeenCalledWith(
				conversationId,
				expect.objectContaining({
					last_message_id: "snapshot-1",
					last_message_at: expect.any(String),
					message_count: 1,
				}),
			);
		});

		it("should delete messages after checking conversation ownership", async () => {
			const conversationId = "conv-123";
			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.getConversationMessageMetadata.mockResolvedValue({
				last_message_id: "remaining-2",
				message_count: 2,
			});

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			await manager.deleteMessages(conversationId, ["message-1", "message-2"]);

			expect(mockDatabase.deleteMessages).toHaveBeenCalledWith(conversationId, [
				"message-1",
				"message-2",
			]);
			expect(mockDatabase.deleteMessage).not.toHaveBeenCalled();
			expect(mockDatabase.getConversationMessageMetadata).toHaveBeenCalledWith(conversationId);
			expect(mockDatabase.updateConversation).toHaveBeenCalledWith(
				conversationId,
				expect.objectContaining({
					last_message_id: "remaining-2",
					last_message_at: expect.any(String),
					message_count: 2,
				}),
			);
		});

		it("should clear conversation message metadata when deleting the final messages", async () => {
			const conversationId = "conv-empty";
			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.getConversationMessageMetadata.mockResolvedValue({
				last_message_id: null,
				message_count: 0,
			});

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			await manager.deleteMessages(conversationId, ["message-1"]);

			expect(mockDatabase.updateConversation).toHaveBeenCalledWith(conversationId, {
				last_message_id: null,
				last_message_at: null,
				message_count: 0,
			});
		});
	});

	describe("shareConversation", () => {
		it("should share conversation and return share_id", async () => {
			const conversationId = "conv-123";
			const shareId = "share-123";

			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
				share_id: null,
			});
			mockDatabase.updateConversation.mockResolvedValue({
				share_id: shareId,
			});

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			const result = await manager.shareConversation(conversationId);

			expect(result).toEqual({ share_id: expect.any(String) });
			expect(mockDatabase.updateConversation).toHaveBeenCalledWith(
				conversationId,
				expect.objectContaining({
					is_public: 1,
					share_id: expect.any(String),
				}),
			);
		});
	});

	describe("getPublicConversation", () => {
		it("hides snapshot messages from shared conversation messages", async () => {
			mockDatabase.getConversationByShareId.mockResolvedValue({
				id: "conv-123",
				is_public: 1,
			});
			mockDatabase.getMessages.mockResolvedValue([
				{
					id: "snapshot-1",
					role: "assistant",
					content: "Conversation snapshot",
					parts: JSON.stringify([{ type: "snapshot", summary: "Hidden summary" }]),
				},
				{
					id: "compaction-1",
					role: "compaction",
					content: "Context compacted",
					parts: JSON.stringify([
						{ type: "compaction", status: "completed", label: "Context compacted" },
					]),
				},
				{
					id: "message-1",
					role: "user",
					content: "Visible message",
				},
			]);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
			});

			const result = await manager.getPublicConversation("share-123", 50, undefined, {
				includeArchived: true,
			});

			expect(result).toEqual([
				expect.objectContaining({
					id: "compaction-1",
					role: "compaction",
				}),
				expect.objectContaining({
					id: "message-1",
					content: "Visible message",
				}),
			]);
		});

		it("fills public pages with visible messages when raw pages include snapshots", async () => {
			mockDatabase.getConversationByShareId.mockResolvedValue({
				id: "conv-123",
				is_public: 1,
			});
			mockDatabase.getMessages
				.mockResolvedValueOnce([
					{
						id: "message-1",
						role: "user",
						content: "Visible one",
					},
					{
						id: "snapshot-1",
						role: "assistant",
						content: "Conversation snapshot",
						parts: JSON.stringify([{ type: "snapshot", summary: "Hidden summary" }]),
					},
				])
				.mockResolvedValueOnce([
					{
						id: "message-2",
						role: "assistant",
						content: "Visible two",
					},
				]);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
			});

			const result = await manager.getPublicConversation("share-123", 2, undefined, {
				includeArchived: true,
			});

			expect(mockDatabase.getMessages).toHaveBeenNthCalledWith(1, "conv-123", 2, undefined, {
				includeArchived: true,
			});
			expect(mockDatabase.getMessages).toHaveBeenNthCalledWith(2, "conv-123", 1, "snapshot-1", {
				includeArchived: true,
			});
			expect(result).toEqual([
				expect.objectContaining({
					id: "message-1",
					content: "Visible one",
				}),
				expect.objectContaining({
					id: "message-2",
					content: "Visible two",
				}),
			]);
		});
	});

	describe("getConversationDetails", () => {
		it("hides snapshot messages from visible conversation details by default", async () => {
			const conversationId = "conv-123";
			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.getConversationMessages.mockResolvedValue([
				{
					id: "snapshot-1",
					role: "assistant",
					content: "Conversation snapshot",
					parts: JSON.stringify([{ type: "snapshot", summary: "Older context." }]),
				},
				{
					id: "msg-1",
					role: "user",
					content: "Keep this visible",
					parts: JSON.stringify([{ type: "text", text: "Keep this visible" }]),
				},
			]);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			const result = await manager.getConversationDetails(conversationId);

			expect(result.messages).toEqual([
				expect.objectContaining({
					id: "msg-1",
					content: "Keep this visible",
				}),
			]);
		});

		it("keeps compaction markers visible while hiding snapshots from conversation details", async () => {
			const conversationId = "conv-123";
			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.getConversationMessages.mockResolvedValue([
				{
					id: "snapshot-1",
					role: "assistant",
					content: "Conversation snapshot",
					parts: JSON.stringify([{ type: "snapshot", summary: "Older context." }]),
				},
				{
					id: "compaction-1",
					role: "compaction",
					content: "Context compacted",
					parts: JSON.stringify([
						{ type: "compaction", status: "completed", label: "Context compacted" },
					]),
				},
				{
					id: "msg-1",
					role: "user",
					content: "Keep this visible",
					parts: JSON.stringify([{ type: "text", text: "Keep this visible" }]),
				},
			]);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			const result = await manager.getConversationDetails(conversationId);

			expect(result.messages).toEqual([
				expect.objectContaining({
					id: "compaction-1",
					role: "compaction",
				}),
				expect.objectContaining({
					id: "msg-1",
					content: "Keep this visible",
				}),
			]);
		});

		it("loads full archived history for conversation details", async () => {
			const conversationId = "conv-123";
			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.getConversationMessages.mockResolvedValue([]);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			await manager.getConversationDetails(conversationId, {
				includeArchived: true,
			});

			expect(mockDatabase.getConversationMessages).toHaveBeenCalledWith(
				conversationId,
				0,
				undefined,
				{
					includeArchived: true,
				},
			);
		});

		it("can include snapshot messages for internal callers", async () => {
			const conversationId = "conv-123";
			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.getConversationMessages.mockResolvedValue([
				{
					id: "snapshot-1",
					role: "assistant",
					content: "Conversation snapshot",
					parts: JSON.stringify([{ type: "snapshot", summary: "Older context." }]),
				},
			]);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			const result = await manager.getConversationDetails(conversationId, {
				includeSnapshots: true,
			});

			expect(result.messages).toEqual([
				expect.objectContaining({
					id: "snapshot-1",
					parts: [{ type: "snapshot", summary: "Older context." }],
				}),
			]);
		});
	});

	describe("error handling", () => {
		it("should handle database errors gracefully", async () => {
			mockDatabase.getConversation.mockRejectedValue(new Error("Database error"));

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			await expect(manager.get("conv-123")).rejects.toThrow("Database error");
		});

		it("should require user for authenticated operations", async () => {
			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: null,
			});

			await expect(manager.get("conv-123")).rejects.toThrow(
				"User ID is required to retrieve messages",
			);
		});
	});

	describe("getVisibleMessages", () => {
		it("loads archived visible history while hiding snapshots", async () => {
			const conversationId = "conv-123";
			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.getConversationMessages.mockResolvedValue([
				{
					id: "snapshot-1",
					role: "assistant",
					content: "Conversation snapshot",
					parts: JSON.stringify([{ type: "snapshot", summary: "Older context." }]),
				},
				{
					id: "compaction-1",
					role: "compaction",
					content: "Context compacted",
					parts: JSON.stringify([
						{ type: "compaction", status: "completed", label: "Context compacted" },
					]),
				},
				{
					id: "message-1",
					role: "user",
					content: "Visible message",
				},
			]);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			const result = await manager.getVisibleMessages(conversationId, 50);

			expect(mockDatabase.getConversationMessages).toHaveBeenCalledWith(
				conversationId,
				50,
				undefined,
				{
					includeArchived: true,
				},
			);
			expect(result).toEqual([
				expect.objectContaining({
					id: "compaction-1",
					role: "compaction",
				}),
				expect.objectContaining({
					id: "message-1",
					content: "Visible message",
				}),
			]);
		});

		it("fills visible pages when archived pages include snapshots", async () => {
			const conversationId = "conv-123";
			mockDatabase.getConversation.mockResolvedValue({
				id: conversationId,
				user_id: mockUser.id,
			});
			mockDatabase.getConversationMessages
				.mockResolvedValueOnce([
					{
						id: "message-1",
						role: "user",
						content: "Visible one",
					},
					{
						id: "snapshot-1",
						role: "assistant",
						content: "Conversation snapshot",
						parts: JSON.stringify([{ type: "snapshot", summary: "Hidden summary" }]),
					},
				])
				.mockResolvedValueOnce([
					{
						id: "message-2",
						role: "assistant",
						content: "Visible two",
					},
				]);

			const manager = ConversationManager.getInstance({
				database: mockDatabase as any,
				user: mockUser,
			});

			const result = await manager.getVisibleMessages(conversationId, 2);

			expect(mockDatabase.getConversationMessages).toHaveBeenNthCalledWith(
				1,
				conversationId,
				2,
				undefined,
				{
					includeArchived: true,
				},
			);
			expect(mockDatabase.getConversationMessages).toHaveBeenNthCalledWith(
				2,
				conversationId,
				1,
				"snapshot-1",
				{
					includeArchived: true,
				},
			);
			expect(result).toEqual([
				expect.objectContaining({
					id: "message-1",
					content: "Visible one",
				}),
				expect.objectContaining({
					id: "message-2",
					content: "Visible two",
				}),
			]);
		});
	});
});
