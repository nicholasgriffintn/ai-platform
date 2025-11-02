import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationManager } from "../conversationManager";

const mockDatabase = {
	getConversation: vi.fn(),
	createConversation: vi.fn(),
	createMessage: vi.fn(),
	updateConversationAfterMessage: vi.fn(),
	getConversationMessages: vi.fn(),
	updateMessage: vi.fn(),
	getUserConversations: vi.fn(),
	updateConversation: vi.fn(),
	getMessageById: vi.fn(),
	getConversationByShareId: vi.fn(),
	getMessages: vi.fn(),
	deleteAllChatCompletions: vi.fn(),
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
			mockUsageManager.getUsageLimits.mockRejectedValue(
				new Error("Database error"),
			);

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

			expect(mockUsageManager.checkUsageByModel).toHaveBeenCalledWith(
				"gpt-4",
				false,
			);
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

			await expect(manager.get("nonexistent")).rejects.toThrow(
				"Conversation not found",
			);
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

			expect(mockDatabase.updateConversation).toHaveBeenCalledWith(
				conversationId,
				{ title: "New Title" },
			);
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

			expect(mockDatabase.updateConversation).toHaveBeenCalledWith(
				conversationId,
				{ is_archived: true },
			);
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

	describe("error handling", () => {
		it("should handle database errors gracefully", async () => {
			mockDatabase.getConversation.mockRejectedValue(
				new Error("Database error"),
			);

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
});
