import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleDeleteChatCompletion } from "../deleteChatCompletion";

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

describe("handleDeleteChatCompletion", () => {
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		const { ConversationManager } = await import("~/lib/conversationManager");

		mockConversationManager = {
			updateConversation: vi.fn(),
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
				handleDeleteChatCompletion(mockServiceContext, "completion-123"),
			).rejects.toThrow("User is not authenticated");
		});

		it("should surface errors from ensureDatabase", async () => {
			mockServiceContext.ensureDatabase.mockImplementationOnce(() => {
				throw new Error("Database not configured");
			});

			await expect(() =>
				handleDeleteChatCompletion(mockServiceContext, "completion-123"),
			).rejects.toThrow("Database not configured");
		});
	});

	describe("successful conversation deletion", () => {
		it("should archive conversation successfully", async () => {
			const completionId = "completion-123";

			mockConversationManager.updateConversation.mockResolvedValue(undefined);

			const result = await handleDeleteChatCompletion(
				mockServiceContext,
				completionId,
			);

			expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(
				completionId,
				{
					archived: true,
				},
			);
			expect(result).toEqual({
				success: true,
				message: "Conversation has been archived",
			});
		});

		it("should handle empty completion ID", async () => {
			mockConversationManager.updateConversation.mockResolvedValue(undefined);

			const result = await handleDeleteChatCompletion(mockServiceContext, "");

			expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(
				"",
				{
					archived: true,
				},
			);
			expect(result.success).toBe(true);
		});
	});

	describe("error handling", () => {
		it("should handle conversation not found", async () => {
			const completionId = "nonexistent-completion";

			mockConversationManager.updateConversation.mockRejectedValue(
				new Error("Conversation not found"),
			);

			await expect(() =>
				handleDeleteChatCompletion(mockServiceContext, completionId),
			).rejects.toThrow("Conversation not found");
		});
	});
});
