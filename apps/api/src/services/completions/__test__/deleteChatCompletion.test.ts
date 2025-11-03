import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleDeleteChatCompletion } from "../deleteChatCompletion";

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

describe("handleDeleteChatCompletion", () => {
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		({ resolveServiceContext } = await import("~/lib/context/serviceContext"));
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
				handleDeleteChatCompletion(requestWithoutUser, "completion-123"),
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
				handleDeleteChatCompletion(requestWithoutDB, "completion-123"),
			).rejects.toThrow("Database not configured");
		});
	});

	describe("successful conversation deletion", () => {
		it("should archive conversation successfully", async () => {
			const completionId = "completion-123";

			mockConversationManager.updateConversation.mockResolvedValue(undefined);

			const result = await handleDeleteChatCompletion(
				// @ts-expect-error - mock request
				mockRequest,
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

			// @ts-expect-error - mock request
			const result = await handleDeleteChatCompletion(mockRequest, "");

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
				// @ts-expect-error - mock request
				handleDeleteChatCompletion(mockRequest, completionId),
			).rejects.toThrow("Conversation not found");
		});

		it("should handle service context errors", async () => {
			vi.mocked(resolveServiceContext).mockImplementationOnce(() => {
				throw new Error("Database connection failed");
			});

			await expect(() =>
				// @ts-expect-error - mock request
				handleDeleteChatCompletion(mockRequest, "completion-123"),
			).rejects.toThrow("Database connection failed");
		});
	});
});
