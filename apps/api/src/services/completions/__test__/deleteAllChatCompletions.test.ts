import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleDeleteAllChatCompletions } from "../deleteAllChatCompletions";

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

const mockRequest = {
	env: mockEnv,
	user: mockUser,
};

let mockServiceContext: any;
let resolveServiceContext: any;

describe("handleDeleteAllChatCompletions", () => {
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		({ resolveServiceContext } = await import("~/lib/context/serviceContext"));
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
		it("should throw error for missing user ID", async () => {
			const requestWithoutUser = {
				env: mockEnv,
				user: null,
			} as any;

			await expect(() =>
				handleDeleteAllChatCompletions(requestWithoutUser),
			).rejects.toThrow("User ID is required to delete a conversation");
		});

		it("should surface errors from service context creation", async () => {
			const requestWithoutDB = {
				env: {},
				user: mockUser,
			} as any;

			vi.mocked(resolveServiceContext).mockImplementationOnce(() => {
				throw new Error("Database not configured");
			});

			await expect(() =>
				handleDeleteAllChatCompletions(requestWithoutDB),
			).rejects.toThrow("Database not configured");
		});
	});

	describe("successful deletion", () => {
		it("should delete all conversations successfully", async () => {
			mockConversationManager.deleteAllChatCompletions.mockResolvedValue(
				undefined,
			);

			// @ts-expect-error - mock request
			const result = await handleDeleteAllChatCompletions(mockRequest);

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
				// @ts-expect-error - mock request
				handleDeleteAllChatCompletions(mockRequest),
			).rejects.toThrow("Deletion failed");
		});

		it("should handle service context errors", async () => {
			vi.mocked(resolveServiceContext).mockImplementationOnce(() => {
				throw new Error("Database connection failed");
			});

			await expect(() =>
				// @ts-expect-error - mock request
				handleDeleteAllChatCompletions(mockRequest),
			).rejects.toThrow("Database connection failed");
		});
	});
});
