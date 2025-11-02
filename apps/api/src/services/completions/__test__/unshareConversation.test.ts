import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleUnshareConversation } from "../unshareConversation";

vi.mock("~/lib/database", () => ({
	Database: {
		getInstance: vi.fn(),
	},
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

describe("handleUnshareConversation", () => {
	let mockDatabase: any;
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		const { Database } = await import("~/lib/database");
		const { ConversationManager } = await import("~/lib/conversationManager");

		mockDatabase = {
			getUserSettings: vi.fn(),
		};

		mockConversationManager = {
			unshareConversation: vi.fn(),
		};

		vi.mocked(Database.getInstance).mockReturnValue(mockDatabase);
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
				handleUnshareConversation(
					// @ts-expect-error - mock request
					{ env: mockEnv, user: null },
					"completion-123",
				),
			).rejects.toThrow("Authentication required");
		});

		it("should throw error for user without ID", async () => {
			const userWithoutId = { email: "test@example.com" } as any;

			await expect(() =>
				handleUnshareConversation(
					// @ts-expect-error - mock request
					{ env: mockEnv, user: userWithoutId },
					"completion-123",
				),
			).rejects.toThrow("Authentication required");
		});
	});

	describe("successful unsharing", () => {
		it("should unshare conversation successfully", async () => {
			const completionId = "completion-123";

			mockConversationManager.unshareConversation.mockResolvedValue(undefined);

			const result = await handleUnshareConversation(
				// @ts-expect-error - mock request
				{ env: mockEnv, user: mockUser },
				completionId,
			);

			expect(mockConversationManager.unshareConversation).toHaveBeenCalledWith(
				completionId,
			);
			expect(result).toEqual({ success: true });
		});

		it("should handle empty completion ID", async () => {
			mockConversationManager.unshareConversation.mockResolvedValue(undefined);

			const result = await handleUnshareConversation(
				// @ts-expect-error - mock request
				{ env: mockEnv, user: mockUser },
				"",
			);

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
				handleUnshareConversation(
					// @ts-expect-error - mock request
					{ env: mockEnv, user: mockUser },
					completionId,
				),
			).rejects.toThrow("Conversation not found");
		});

		it("should handle database connection errors", async () => {
			const { Database } = await import("~/lib/database");
			vi.mocked(Database.getInstance).mockImplementation(() => {
				throw new Error("Database connection failed");
			});

			await expect(() =>
				handleUnshareConversation(
					// @ts-expect-error - mock request
					{ env: mockEnv, user: mockUser },
					"completion-123",
				),
			).rejects.toThrow("Database connection failed");
		});
	});
});
