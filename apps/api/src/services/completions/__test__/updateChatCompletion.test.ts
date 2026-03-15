import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleUpdateChatCompletion } from "../updateChatCompletion";

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

describe("handleUpdateChatCompletion", () => {
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
				handleUpdateChatCompletion(mockServiceContext, "completion-123", {
					title: "Test",
				}),
			).rejects.toThrow("User is not authenticated");
		});

		it("should surface errors from ensureDatabase", async () => {
			mockServiceContext.ensureDatabase.mockImplementationOnce(() => {
				throw new Error("Database not configured");
			});

			await expect(() =>
				handleUpdateChatCompletion(mockServiceContext, "completion-123", {
					title: "Test",
				}),
			).rejects.toThrow("Database not configured");
		});
	});

	describe("successful updates", () => {
		it("should update conversation title successfully", async () => {
			const completionId = "completion-123";
			const updates = { title: "New Title" };
			const mockResult = {
				id: completionId,
				title: "New Title",
				updated_at: new Date().toISOString(),
			};

			mockConversationManager.updateConversation.mockResolvedValue(mockResult);

			const result = await handleUpdateChatCompletion(
				mockServiceContext,
				completionId,
				updates,
			);

			expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(
				completionId,
				updates,
			);
			expect(result).toEqual(mockResult);
		});

		it("should update conversation archived status", async () => {
			const completionId = "completion-456";
			const updates = { archived: true };
			const mockResult = {
				id: completionId,
				archived: true,
				updated_at: new Date().toISOString(),
			};

			mockConversationManager.updateConversation.mockResolvedValue(mockResult);

			const result = await handleUpdateChatCompletion(
				mockServiceContext,
				completionId,
				updates,
			);

			expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(
				completionId,
				updates,
			);
			expect(result.archived).toBe(true);
		});

		it("should handle empty completion ID", async () => {
			const updates = { title: "Test" };
			const mockResult = {
				id: "",
				title: "Test",
			};

			mockConversationManager.updateConversation.mockResolvedValue(mockResult);

			const result = await handleUpdateChatCompletion(
				mockServiceContext,
				"",
				updates,
			);

			expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(
				"",
				updates,
			);
			expect(result).toEqual(mockResult);
		});
	});

	describe("error handling", () => {
		it("should handle conversation not found errors", async () => {
			const completionId = "nonexistent";
			const updates = { title: "New Title" };

			mockConversationManager.updateConversation.mockRejectedValue(
				new Error("Conversation not found"),
			);

			await expect(() =>
				handleUpdateChatCompletion(mockServiceContext, completionId, updates),
			).rejects.toThrow("Conversation not found");
		});
	});
});
