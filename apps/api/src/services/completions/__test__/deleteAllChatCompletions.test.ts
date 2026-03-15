import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleDeleteAllChatCompletions } from "../deleteAllChatCompletions";

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

describe("handleDeleteAllChatCompletions", () => {
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		const { ConversationManager } = await import("~/lib/conversationManager");

		mockConversationManager = {
			deleteAllChatCompletions: vi.fn(),
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
				handleDeleteAllChatCompletions(mockServiceContext),
			).rejects.toThrow("User is not authenticated");
		});

		it("should surface errors from ensureDatabase", async () => {
			mockServiceContext.ensureDatabase.mockImplementationOnce(() => {
				throw new Error("Database not configured");
			});

			await expect(() =>
				handleDeleteAllChatCompletions(mockServiceContext),
			).rejects.toThrow("Database not configured");
		});
	});

	describe("successful deletion", () => {
		it("should delete all conversations successfully", async () => {
			mockConversationManager.deleteAllChatCompletions.mockResolvedValue(
				undefined,
			);

			const result = await handleDeleteAllChatCompletions(mockServiceContext);

			expect(
				mockConversationManager.deleteAllChatCompletions,
			).toHaveBeenCalledWith("user-123");
			expect(result).toEqual({
				success: true,
				message: "Conversations have been deleted",
			});
		});
	});

	describe("error handling", () => {
		it("should handle deletion errors", async () => {
			mockConversationManager.deleteAllChatCompletions.mockRejectedValue(
				new Error("Deletion failed"),
			);

			await expect(() =>
				handleDeleteAllChatCompletions(mockServiceContext),
			).rejects.toThrow("Deletion failed");
		});
	});
});
