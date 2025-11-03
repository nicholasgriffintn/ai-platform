import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleShareConversation } from "../shareConversation";

vi.mock("~/lib/context/serviceContext", () => ({
	resolveServiceContext: vi.fn(),
}));

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
let resolveServiceContext: any;

describe("handleShareConversation", () => {
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		({ resolveServiceContext } = await import("~/lib/context/serviceContext"));
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
		};

		vi.mocked(resolveServiceContext).mockReturnValue(mockServiceContext);
		vi.mocked(ConversationManager.getInstance).mockReturnValue(
			mockConversationManager,
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("parameter validation", () => {
		it("should throw error for missing user", async () => {
			await expect(() =>
				// @ts-expect-error - mock request
				handleShareConversation({ env: mockEnv, user: null }, "completion-123"),
			).rejects.toThrow("Authentication required");
		});

		it("should throw error for user without ID", async () => {
			const userWithoutId = { email: "test@example.com" } as any;

			await expect(() =>
				handleShareConversation(
					// @ts-expect-error - mock request
					{ env: mockEnv, user: userWithoutId },
					"completion-123",
				),
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
				// @ts-expect-error - mock request
				{ env: mockEnv, user: mockUser },
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

			const result = await handleShareConversation(
				// @ts-expect-error - mock request
				{ env: mockEnv, user: mockUser },
				"",
			);

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
				// @ts-expect-error - mock request
				{ env: mockEnv, user: mockUser },
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
				// @ts-expect-error - mock request
				handleShareConversation({ env: mockEnv, user: mockUser }, completionId),
			).rejects.toThrow("Conversation not found");
		});

		it("should handle service context errors", async () => {
			vi.mocked(resolveServiceContext).mockImplementationOnce(() => {
				throw new Error("Database connection failed");
			});

			await expect(() =>
				handleShareConversation(
					// @ts-expect-error - mock request
					{ env: mockEnv, user: mockUser },
					"completion-123",
				),
			).rejects.toThrow("Database connection failed");
		});
	});
});
