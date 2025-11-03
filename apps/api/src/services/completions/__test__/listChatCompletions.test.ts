import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleListChatCompletions } from "../listChatCompletions";

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

describe("handleListChatCompletions", () => {
	let mockDatabase: any;
	let mockConversationManager: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		({ resolveServiceContext } = await import("~/lib/context/serviceContext"));
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
				handleListChatCompletions(requestWithoutUser),
			).rejects.toThrow("User ID is required to list conversations");
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
				handleListChatCompletions(requestWithoutDB),
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

			// @ts-expect-error - mock request
			const result = await handleListChatCompletions(mockRequest);

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

			// @ts-expect-error - mock request
			const result = await handleListChatCompletions(mockRequest, options);

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

			// @ts-expect-error - mock request
			const result = await handleListChatCompletions(mockRequest);

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
				// @ts-expect-error - mock request
				handleListChatCompletions(mockRequest),
			).rejects.toThrow("Database connection failed");
		});

		it("should handle service context errors", async () => {
			vi.mocked(resolveServiceContext).mockImplementationOnce(() => {
				throw new Error("Database connection failed");
			});

			await expect(() =>
				// @ts-expect-error - mock request
				handleListChatCompletions(mockRequest),
			).rejects.toThrow("Database connection failed");
		});
	});
});
