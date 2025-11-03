import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleGetChatCompletion } from "../getChatCompletion";

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

describe("handleGetChatCompletion", () => {
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		({ resolveServiceContext } = await import("~/lib/context/serviceContext"));
		const { ConversationManager } = await import("~/lib/conversationManager");

		mockConversationManager = {
			getConversationDetails: vi.fn(),
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
				handleGetChatCompletion(requestWithoutUser, "completion-123"),
			).rejects.toThrow("User ID is required to get a conversation");
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
				handleGetChatCompletion(requestWithoutDB, "completion-123"),
			).rejects.toThrow("Database not configured");
		});
	});

	describe("successful conversation retrieval", () => {
		it("should get conversation details", async () => {
			const completionId = "completion-123";
			const mockConversation = {
				id: completionId,
				title: "Test Conversation",
				messages: [
					{ role: "user", content: "Hello" },
					{ role: "assistant", content: "Hi there!" },
				],
				created_at: "2023-01-01T00:00:00Z",
			};

			mockConversationManager.getConversationDetails.mockResolvedValue(
				mockConversation,
			);

			// @ts-expect-error - mock request
			const result = await handleGetChatCompletion(mockRequest, completionId);

			expect(
				mockConversationManager.getConversationDetails,
			).toHaveBeenCalledWith(completionId);
			expect(result).toEqual(mockConversation);
		});

		it("should handle conversation with no messages", async () => {
			const completionId = "completion-empty";
			const mockEmptyConversation = {
				id: completionId,
				title: "Empty Conversation",
				messages: [],
				created_at: "2023-01-01T00:00:00Z",
			};

			mockConversationManager.getConversationDetails.mockResolvedValue(
				mockEmptyConversation,
			);

			// @ts-expect-error - mock request
			const result = await handleGetChatCompletion(mockRequest, completionId);

			expect(result.messages).toEqual([]);
			expect(result.id).toBe(completionId);
		});

		it("should handle empty completion ID", async () => {
			const mockConversation = {
				id: "",
				title: "Test",
				messages: [],
			};

			mockConversationManager.getConversationDetails.mockResolvedValue(
				mockConversation,
			);

			// @ts-expect-error - mock request
			const result = await handleGetChatCompletion(mockRequest, "");

			expect(
				mockConversationManager.getConversationDetails,
			).toHaveBeenCalledWith("");
			expect(result).toEqual(mockConversation);
		});
	});

	describe("error handling", () => {
		it("should handle conversation not found", async () => {
			const completionId = "nonexistent-completion";

			mockConversationManager.getConversationDetails.mockRejectedValue(
				new Error("Conversation not found"),
			);

			await expect(() =>
				// @ts-expect-error - mock request
				handleGetChatCompletion(mockRequest, completionId),
			).rejects.toThrow("Conversation not found");
		});

		it("should handle service context errors", async () => {
			vi.mocked(resolveServiceContext).mockImplementationOnce(() => {
				throw new Error("Database connection failed");
			});

			await expect(() =>
				// @ts-expect-error - mock request
				handleGetChatCompletion(mockRequest, "completion-123"),
			).rejects.toThrow("Database connection failed");
		});
	});
});
