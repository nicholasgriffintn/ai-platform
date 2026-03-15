import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleShareConversation } from "../shareConversation";

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

describe("handleShareConversation", () => {
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		const { ConversationManager } = await import("~/lib/conversationManager");

		mockConversationManager = {
			shareConversation: vi.fn(),
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
				handleShareConversation(mockServiceContext, "completion-123"),
			).rejects.toThrow("Authentication required");
		});
	});

	describe("successful sharing", () => {
		it("should share conversation successfully", async () => {
			const completionId = "completion-123";
			const mockResult = {
				share_id: "share-abc123",
			};

			mockConversationManager.shareConversation.mockResolvedValue(mockResult);

			const result = await handleShareConversation(
				mockServiceContext,
				completionId,
			);

			expect(mockConversationManager.shareConversation).toHaveBeenCalledWith(
				completionId,
			);
			expect(result).toEqual({ share_id: "share-abc123" });
		});

		it("should handle empty completion ID", async () => {
			const mockResult = {
				share_id: "empty-share-id",
			};

			mockConversationManager.shareConversation.mockResolvedValue(mockResult);

			const result = await handleShareConversation(mockServiceContext, "");

			expect(mockConversationManager.shareConversation).toHaveBeenCalledWith(
				"",
			);
			expect(result.share_id).toBe("empty-share-id");
		});

		it("should handle already shared conversation", async () => {
			const completionId = "completion-456";
			const mockResult = {
				share_id: "existing-share-id",
			};

			mockConversationManager.shareConversation.mockResolvedValue(mockResult);

			const result = await handleShareConversation(
				mockServiceContext,
				completionId,
			);

			expect(result.share_id).toBe("existing-share-id");
		});
	});

	describe("error handling", () => {
		it("should handle conversation not found errors", async () => {
			const completionId = "nonexistent";

			mockConversationManager.shareConversation.mockRejectedValue(
				new Error("Conversation not found"),
			);

			await expect(() =>
				handleShareConversation(mockServiceContext, completionId),
			).rejects.toThrow("Conversation not found");
		});
	});
});
