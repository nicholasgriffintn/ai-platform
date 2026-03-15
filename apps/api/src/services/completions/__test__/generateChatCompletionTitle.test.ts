import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleGenerateChatCompletionTitle } from "../generateChatCompletionTitle";

vi.mock("~/lib/conversationManager", () => ({
	ConversationManager: {
		getInstance: vi.fn(),
	},
}));

vi.mock("~/lib/providers/models", () => ({
	getAuxiliaryModel: vi.fn(),
}));

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: vi.fn(),
}));

vi.mock("~/lib/chat/utils", () => ({
	sanitiseMessages: vi.fn(),
}));

const mockEnv = {
	DB: "test-db",
	AI: "test-ai",
};

const mockUser = {
	id: "user-123",
	email: "test@example.com",
};

let mockServiceContext: any;

describe("handleGenerateChatCompletionTitle", () => {
	let mockConversationManager: any;
	let mockGetAuxiliaryModel: any;
	let mockChatCapability: any;
	let mockSanitiseMessages: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		const { ConversationManager } = await import("~/lib/conversationManager");
		const { getAuxiliaryModel } = await import("~/lib/providers/models");
		const chatCapability = await import("~/lib/providers/capabilities/chat");
		const { sanitiseMessages } = await import("~/lib/chat/utils");

		mockConversationManager = {
			get: vi.fn(),
			updateConversation: vi.fn(),
		};

		mockGetAuxiliaryModel = vi.mocked(getAuxiliaryModel);
		mockChatCapability = vi.mocked(chatCapability);
		mockSanitiseMessages = vi.mocked(sanitiseMessages);

		mockServiceContext = {
			env: mockEnv,
			user: mockUser,
			ensureDatabase: vi.fn(),
			database: { getUserSettings: vi.fn() },
			repositories: {} as any,
			requireUser: vi.fn().mockReturnValue(mockUser),
		};

		vi.mocked(ConversationManager.getInstance).mockReturnValue(
			mockConversationManager,
		);

		mockGetAuxiliaryModel.mockResolvedValue({
			model: "test-model",
			provider: "test-provider",
		});

		mockChatCapability.getChatProvider.mockReturnValue({
			getResponse: vi.fn().mockResolvedValue({
				response: "Generated Title",
			}),
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("parameter validation", () => {
		it("should throw error for missing AI binding", async () => {
			mockServiceContext.env = { DB: "test-db" };

			await expect(() =>
				handleGenerateChatCompletionTitle(mockServiceContext, "completion-123"),
			).rejects.toThrow("AI binding is not available");
		});

		it("should throw error for missing user", async () => {
			mockServiceContext.requireUser.mockImplementationOnce(() => {
				throw new Error("Authentication required");
			});

			await expect(() =>
				handleGenerateChatCompletionTitle(mockServiceContext, "completion-123"),
			).rejects.toThrow("Authentication required");
		});

		it("should throw error for missing DB binding", async () => {
			mockServiceContext.ensureDatabase.mockImplementationOnce(() => {
				throw new Error("Database not configured");
			});

			await expect(() =>
				handleGenerateChatCompletionTitle(mockServiceContext, "completion-123"),
			).rejects.toThrow("Database not configured");
		});
	});

	describe("successful title generation", () => {
		it("should generate title with provided messages", async () => {
			const completionId = "completion-123";
			const messages = [
				{ role: "user" as const, content: "Hello" },
				{ role: "assistant" as const, content: "Hi there!" },
			];

			mockConversationManager.get.mockResolvedValue([]);
			mockSanitiseMessages.mockReturnValue(messages);

			const result = await handleGenerateChatCompletionTitle(
				mockServiceContext,
				completionId,
				messages,
			);

			expect(mockConversationManager.updateConversation).toHaveBeenCalledWith(
				completionId,
				{ title: "Generated Title" },
			);
			expect(result).toEqual({ title: "Generated Title" });
			expect(mockConversationManager.get).toHaveBeenCalledWith(
				completionId,
				undefined,
				1,
			);
		});

		it("should generate title from conversation messages when no messages provided", async () => {
			const completionId = "completion-123";
			const conversationMessages = [
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi!" },
			];

			mockConversationManager.get.mockResolvedValue(conversationMessages);

			const result = await handleGenerateChatCompletionTitle(
				mockServiceContext,
				completionId,
			);

			expect(result).toEqual({ title: "Generated Title" });
			expect(mockConversationManager.get).toHaveBeenCalledWith(
				completionId,
				undefined,
				expect.any(Number),
			);
		});

		it("should return default title for empty conversation", async () => {
			const completionId = "completion-empty";

			mockConversationManager.get.mockResolvedValue([]);

			const result = await handleGenerateChatCompletionTitle(
				mockServiceContext,
				completionId,
			);

			expect(result).toEqual({ title: "New Conversation" });
			expect(mockConversationManager.updateConversation).not.toHaveBeenCalled();
		});

		it("should trim quotes from generated title", async () => {
			const completionId = "completion-123";
			const messages = [{ role: "user" as const, content: "Test" }];

			mockConversationManager.get.mockResolvedValue([]);
			mockSanitiseMessages.mockReturnValue(messages);

			const mockProvider = mockChatCapability.getChatProvider();
			mockProvider.getResponse.mockResolvedValue({
				response: '"Quoted Title"',
			});

			const result = await handleGenerateChatCompletionTitle(
				mockServiceContext,
				completionId,
				messages,
			);

			expect(result).toEqual({ title: "Quoted Title" });
		});

		it("should truncate long titles", async () => {
			const completionId = "completion-123";
			const messages = [{ role: "user" as const, content: "Test" }];
			const longTitle = "A".repeat(60);

			mockConversationManager.get.mockResolvedValue([]);
			mockSanitiseMessages.mockReturnValue(messages);

			const mockProvider = mockChatCapability.getChatProvider();
			mockProvider.getResponse.mockResolvedValue({
				response: longTitle,
			});

			const result = await handleGenerateChatCompletionTitle(
				mockServiceContext,
				completionId,
				messages,
			);

			expect(result.title).toMatch(/^A{47}\.\.\.$/);
		});
	});

	describe("error handling", () => {
		it("should handle conversation not found", async () => {
			const completionId = "nonexistent";

			mockConversationManager.get.mockRejectedValue(new Error("Not found"));

			await expect(() =>
				handleGenerateChatCompletionTitle(mockServiceContext, completionId),
			).rejects.toThrow(
				"Conversation not found or you don't have access to it",
			);
		});

		it("should handle AI provider errors", async () => {
			const completionId = "completion-123";
			const messages = [{ role: "user" as const, content: "Test" }];

			mockConversationManager.get.mockResolvedValue([]);
			mockSanitiseMessages.mockReturnValue(messages);

			const mockProvider = mockChatCapability.getChatProvider();
			mockProvider.getResponse.mockRejectedValue(
				new Error("AI provider failed"),
			);

			await expect(() =>
				handleGenerateChatCompletionTitle(
					mockServiceContext,
					completionId,
					messages,
				),
			).rejects.toThrow("AI provider failed");
		});
	});
});
