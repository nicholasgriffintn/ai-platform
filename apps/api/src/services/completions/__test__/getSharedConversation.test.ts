import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleGetSharedConversation } from "../getSharedConversation";

vi.mock("~/lib/conversationManager", () => ({
	ConversationManager: {
		getInstance: vi.fn(),
	},
}));

const mockEnv = {
	DB: "test-db",
};

let mockServiceContext: any;

describe("handleGetSharedConversation", () => {
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		const { ConversationManager } = await import("~/lib/conversationManager");

		mockConversationManager = {
			getPublicConversation: vi.fn(),
		};

		mockServiceContext = {
			env: mockEnv,
			ensureDatabase: vi.fn(),
			database: {} as any,
			repositories: {} as any,
		};

		vi.mocked(ConversationManager.getInstance).mockReturnValue(
			mockConversationManager,
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("successful retrieval", () => {
		it("should retrieve shared conversation successfully", async () => {
			const shareId = "share-123";
			const mockMessages = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi there!" },
			];

			mockConversationManager.getPublicConversation.mockResolvedValue(
				mockMessages,
			);

			const result = await handleGetSharedConversation(
				mockServiceContext,
				shareId,
			);

			expect(
				mockConversationManager.getPublicConversation,
			).toHaveBeenCalledWith(shareId, 50, undefined);
			expect(result).toEqual({
				messages: mockMessages,
				share_id: shareId,
			});
		});

		it("should handle conversation with no messages", async () => {
			const shareId = "share-empty";

			mockConversationManager.getPublicConversation.mockResolvedValue([]);

			const result = await handleGetSharedConversation(
				mockServiceContext,
				shareId,
			);

			expect(result.messages).toEqual([]);
			expect(result.share_id).toBe(shareId);
		});

		it("should handle empty share ID", async () => {
			mockConversationManager.getPublicConversation.mockResolvedValue([]);

			const result = await handleGetSharedConversation(mockServiceContext, "");

			expect(result.messages).toEqual([]);
			expect(result.share_id).toBe("");
		});

		it("should handle custom limit and after parameters", async () => {
			const shareId = "share-123";
			const limit = 25;
			const after = "cursor-123";
			const mockMessages = [{ role: "user", content: "Test" }];

			mockConversationManager.getPublicConversation.mockResolvedValue(
				mockMessages,
			);

			const result = await handleGetSharedConversation(
				mockServiceContext,
				shareId,
				limit,
				after,
			);

			expect(
				mockConversationManager.getPublicConversation,
			).toHaveBeenCalledWith(shareId, limit, after);
			expect(result).toEqual({
				messages: mockMessages,
				share_id: shareId,
			});
		});
	});

	describe("error handling", () => {
		it("should handle conversation not found errors", async () => {
			const shareId = "nonexistent";

			mockConversationManager.getPublicConversation.mockRejectedValue(
				new Error("Shared conversation not found"),
			);

			await expect(() =>
				handleGetSharedConversation(mockServiceContext, shareId),
			).rejects.toThrow("Shared conversation not found");
		});

		it("should surface errors from ensureDatabase", async () => {
			mockServiceContext.ensureDatabase.mockImplementationOnce(() => {
				throw new Error("Database connection failed");
			});

			await expect(() =>
				handleGetSharedConversation(mockServiceContext, "share-123"),
			).rejects.toThrow("Database connection failed");
		});
	});
});
