import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleGetChatCompletion } from "../getChatCompletion";

vi.mock("~/lib/conversationManager", () => ({
	ConversationManager: {
		getInstance: vi.fn(),
	},
}));

const mockEnv = {
	DB: "test-db",
};

const mockUser = {
	id: "user-123",
	email: "test@example.com",
};

let mockServiceContext: any;

describe("handleGetChatCompletion", () => {
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		const { ConversationManager } = await import("~/lib/conversationManager");

		mockConversationManager = {
			getConversationDetails: vi.fn(),
		};

		mockServiceContext = {
			env: mockEnv,
			user: mockUser,
			ensureDatabase: vi.fn(),
			database: {} as any,
			repositories: {} as any,
			requireUser: vi.fn().mockReturnValue(mockUser),
		};

		vi.mocked(ConversationManager.getInstance).mockReturnValue(
			mockConversationManager,
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("parameter validation", () => {
		it("should throw error for missing user ID", async () => {
			mockServiceContext.requireUser.mockImplementationOnce(() => {
				throw new Error("User is not authenticated");
			});

			await expect(() =>
				handleGetChatCompletion(mockServiceContext, "completion-123"),
			).rejects.toThrow("User is not authenticated");
		});

		it("should surface errors from ensureDatabase", async () => {
			mockServiceContext.ensureDatabase.mockImplementationOnce(() => {
				throw new Error("Database not configured");
			});

			await expect(() =>
				handleGetChatCompletion(mockServiceContext, "completion-123"),
			).rejects.toThrow("Database not configured");
		});
	});

	describe("successful conversation retrieval", () => {
		it("should get conversation details", async () => {
			const completionId = "completion-123";
			const mockConversation = {
				id: completionId,
				title: "Test Conversation",
				messages: [
					{ role: "user", content: "Hello" },
					{ role: "assistant", content: "Hi there!" },
				],
				created_at: "2023-01-01T00:00:00Z",
			};

			mockConversationManager.getConversationDetails.mockResolvedValue(
				mockConversation,
			);

			const result = await handleGetChatCompletion(
				mockServiceContext,
				completionId,
			);

			expect(
				mockConversationManager.getConversationDetails,
			).toHaveBeenCalledWith(completionId);
			expect(result).toEqual(mockConversation);
		});

		it("should handle conversation with no messages", async () => {
			const completionId = "completion-empty";
			const mockEmptyConversation = {
				id: completionId,
				title: "Empty Conversation",
				messages: [],
				created_at: "2023-01-01T00:00:00Z",
			};

			mockConversationManager.getConversationDetails.mockResolvedValue(
				mockEmptyConversation,
			);

			const result = await handleGetChatCompletion(
				mockServiceContext,
				completionId,
			);

			expect(result.messages).toEqual([]);
			expect(result.id).toBe(completionId);
		});

		it("should handle empty completion ID", async () => {
			const mockConversation = {
				id: "",
				title: "Test",
				messages: [],
			};

			mockConversationManager.getConversationDetails.mockResolvedValue(
				mockConversation,
			);

			const result = await handleGetChatCompletion(mockServiceContext, "");

			expect(
				mockConversationManager.getConversationDetails,
			).toHaveBeenCalledWith("");
			expect(result).toEqual(mockConversation);
		});
	});

	describe("error handling", () => {
		it("should handle conversation not found", async () => {
			const completionId = "nonexistent-completion";

			mockConversationManager.getConversationDetails.mockRejectedValue(
				new Error("Conversation not found"),
			);

			await expect(() =>
				handleGetChatCompletion(mockServiceContext, completionId),
			).rejects.toThrow("Conversation not found");
		});
	});
});
