import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleUnshareConversation } from "../unshareConversation";

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

describe("handleUnshareConversation", () => {
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		({ resolveServiceContext } = await import("~/lib/context/serviceContext"));
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

		it("should handle service context errors", async () => {
			vi.mocked(resolveServiceContext).mockImplementationOnce(() => {
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
