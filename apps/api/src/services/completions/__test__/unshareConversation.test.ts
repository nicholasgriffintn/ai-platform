import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleUnshareConversation } from "../unshareConversation";

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

describe("handleUnshareConversation", () => {
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		const { ConversationManager } = await import("~/lib/conversationManager");

		mockConversationManager = {
			unshareConversation: vi.fn(),
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
		it("should throw error for missing user", async () => {
			mockServiceContext.requireUser.mockImplementationOnce(() => {
				throw new Error("Authentication required");
			});

			await expect(() =>
				handleUnshareConversation(mockServiceContext, "completion-123"),
			).rejects.toThrow("Authentication required");
		});
	});

	describe("successful unsharing", () => {
		it("should unshare conversation successfully", async () => {
			const completionId = "completion-123";

			mockConversationManager.unshareConversation.mockResolvedValue(undefined);

			const result = await handleUnshareConversation(
				mockServiceContext,
				completionId,
			);

			expect(mockConversationManager.unshareConversation).toHaveBeenCalledWith(
				completionId,
			);
			expect(result).toEqual({ success: true });
		});

		it("should handle empty completion ID", async () => {
			mockConversationManager.unshareConversation.mockResolvedValue(undefined);

			const result = await handleUnshareConversation(mockServiceContext, "");

			expect(mockConversationManager.unshareConversation).toHaveBeenCalledWith(
				"",
			);
			expect(result.success).toBe(true);
		});
	});

	describe("error handling", () => {
		it("should handle conversation not found errors", async () => {
			const completionId = "nonexistent";

			mockConversationManager.unshareConversation.mockRejectedValue(
				new Error("Conversation not found"),
			);

			await expect(() =>
				handleUnshareConversation(mockServiceContext, completionId),
			).rejects.toThrow("Conversation not found");
		});
	});
});
