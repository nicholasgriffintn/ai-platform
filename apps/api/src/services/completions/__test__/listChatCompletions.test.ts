import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleListChatCompletions } from "../listChatCompletions";

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

describe("handleListChatCompletions", () => {
	let mockDatabase: any;
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		const { ConversationManager } = await import("~/lib/conversationManager");

		mockDatabase = {
			getUserSettings: vi.fn(),
		};

		mockConversationManager = {
			list: vi.fn(),
		};

		mockServiceContext = {
			env: mockEnv,
			user: mockUser,
			ensureDatabase: vi.fn(),
			database: mockDatabase,
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
				handleListChatCompletions(mockServiceContext),
			).rejects.toThrow("User is not authenticated");
		});

		it("should surface errors from ensureDatabase", async () => {
			mockServiceContext.ensureDatabase.mockImplementationOnce(() => {
				throw new Error("Database not configured");
			});

			await expect(() =>
				handleListChatCompletions(mockServiceContext),
			).rejects.toThrow("Database not configured");
		});
	});

	describe("successful conversation listing", () => {
		it("should list conversations with default parameters", async () => {
			const mockResult = {
				conversations: [
					{ id: "conv-1", title: "Conversation 1" },
					{ id: "conv-2", title: "Conversation 2" },
				],
				totalPages: 1,
				pageNumber: 1,
				pageSize: 25,
			};

			mockConversationManager.list.mockResolvedValue(mockResult);

			const result = await handleListChatCompletions(mockServiceContext);

			expect(mockConversationManager.list).toHaveBeenCalledWith(25, 1, false);
			expect(result).toEqual(mockResult);
		});

		it("should list conversations with custom parameters", async () => {
			const options = { limit: 10, page: 2, includeArchived: true };
			const mockResult = {
				conversations: [{ id: "conv-1", title: "Test" }],
				totalPages: 3,
				pageNumber: 2,
				pageSize: 10,
			};

			mockConversationManager.list.mockResolvedValue(mockResult);

			const result = await handleListChatCompletions(
				mockServiceContext,
				options,
			);

			expect(mockConversationManager.list).toHaveBeenCalledWith(10, 2, true);
			expect(result).toEqual(mockResult);
		});

		it("should handle empty conversation list", async () => {
			const mockResult = {
				conversations: [],
				totalPages: 0,
				pageNumber: 1,
				pageSize: 25,
			};

			mockConversationManager.list.mockResolvedValue(mockResult);

			const result = await handleListChatCompletions(mockServiceContext);

			expect(result.conversations).toEqual([]);
			expect(result.totalPages).toBe(0);
		});
	});

	describe("error handling", () => {
		it("should handle conversation manager errors", async () => {
			mockConversationManager.list.mockRejectedValue(
				new Error("Database connection failed"),
			);

			await expect(() =>
				handleListChatCompletions(mockServiceContext),
			).rejects.toThrow("Database connection failed");
		});
	});
});
