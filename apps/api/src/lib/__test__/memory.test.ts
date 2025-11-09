import { beforeEach, describe, expect, it, vi } from "vitest";
import * as chatCapability from "~/lib/providers/capabilities/chat";
import * as embeddingHelpers from "~/lib/providers/capabilities/embedding/helpers";
import { parseAIResponseJson } from "~/utils/json";
import { MemoryManager } from "../memory";

const mockEmbeddingProvider = {
	generate: vi.fn(),
	getMatches: vi.fn(),
	getQuery: vi.fn(),
	insert: vi.fn(),
	delete: vi.fn(),
};

vi.mock("~/lib/providers/capabilities/embedding/helpers", () => ({
	getEmbeddingProvider: vi.fn(() => mockEmbeddingProvider),
}));

vi.mock("~/lib/providers/capabilities/chat", () => ({
	getChatProvider: vi.fn(() => ({
		getResponse: vi.fn(),
		name: "test-provider",
		supportsStreaming: false,
		createRealtimeSession: vi.fn(),
	})),
}));

vi.mock("~/lib/providers/models", () => ({
	getAuxiliaryModel: vi.fn().mockResolvedValue({
		model: "gpt-3.5-turbo",
		provider: "openai",
	}),
}));

vi.mock("~/utils/json", () => ({
	parseAIResponseJson: vi.fn(),
}));

vi.mock("~/lib/database", () => ({
	Database: {
		getInstance: () => ({
			getConversation: vi.fn(),
			createConversation: vi.fn(),
		}),
	},
	DatabaseSingleton: {
		getInstance: () => ({
			getConversation: vi.fn(),
			createConversation: vi.fn(),
		}),
	},
}));

describe("MemoryManager", () => {
	const mockEnv = { OPENAI_API_KEY: "test-key" } as any;
	const mockUser = { id: 1, email: "test@example.com" } as any;
	const mockedGetEmbeddingProvider = vi.mocked(
		embeddingHelpers.getEmbeddingProvider,
	);

	beforeEach(async () => {
		vi.clearAllMocks();
		mockEmbeddingProvider.generate.mockReset();
		mockEmbeddingProvider.getMatches.mockReset();
		mockEmbeddingProvider.getQuery.mockReset();
		mockEmbeddingProvider.insert.mockReset();
		mockEmbeddingProvider.delete.mockReset();

		mockEmbeddingProvider.generate.mockResolvedValue([
			{ values: [0.1, 0.2, 0.3], id: "test-id" },
		] as any);
		mockEmbeddingProvider.getMatches.mockResolvedValue({ matches: [] });
		mockEmbeddingProvider.getQuery.mockResolvedValue({
			data: [[0.1, 0.2, 0.3]],
		});
		mockEmbeddingProvider.insert.mockResolvedValue(undefined);
		mockEmbeddingProvider.delete.mockResolvedValue({
			status: "success",
			error: null,
		});

		mockedGetEmbeddingProvider.mockReturnValue(mockEmbeddingProvider as any);
		MemoryManager["instance"] = undefined as any;
	});

	describe("getInstance", () => {
		it("should create new instance each time", () => {
			const instance1 = MemoryManager.getInstance(mockEnv, mockUser);
			const instance2 = MemoryManager.getInstance(mockEnv, mockUser);
			expect(instance1).not.toBe(instance2);
		});
	});

	describe("handleMemory - main bug fix tests", () => {
		it("should process memories when memories_save_enabled is true", async () => {
			const userSettings = {
				memories_save_enabled: true,
				memories_chat_history_enabled: false,
			};

			const messages = [
				{ role: "user", content: "I love Python programming" },
			] as any;

			const mockProvider = {
				getResponse: vi
					.fn()
					.mockResolvedValueOnce({
						response: JSON.stringify({
							storeMemory: true,
							category: "preference",
							summary: "User loves Python programming",
						}),
					})
					.mockResolvedValueOnce({
						response: JSON.stringify([
							"The user enjoys Python programming",
							"Python is preferred by the user for programming",
						]),
					}),
				name: "test-provider",
				supportsStreaming: false,
				createRealtimeSession: vi.fn(),
			};
			vi.mocked(chatCapability.getChatProvider).mockReturnValue(mockProvider);

			vi.mocked(parseAIResponseJson)
				.mockReturnValueOnce({
					data: {
						storeMemory: true,
						category: "preference",
						summary: "User loves Python programming",
					},
					error: null,
				})
				.mockReturnValueOnce({
					data: [
						"The user enjoys Python programming",
						"Python is preferred by the user for programming",
					],
					error: null,
				});

			const manager = MemoryManager.getInstance(mockEnv, mockUser);
			const mockConversationManager = { get: vi.fn() } as any;

			vi.spyOn(manager, "storeMemory").mockResolvedValue("mock-id");

			const result = await manager.handleMemory(
				"I love Python programming",
				messages,
				mockConversationManager,
				"completion-123",
				userSettings as any,
			);

			expect(result).toEqual([
				{
					type: "store",
					text: "User loves Python programming",
					category: "preference",
				},
			]);
		});

		it("should handle chat history snapshots when enabled", async () => {
			const userSettings = {
				memories_save_enabled: false,
				memories_chat_history_enabled: true,
			};

			const messages = [
				{ role: "user", content: "Message 0" },
				{ role: "assistant", content: "Response 0" },
				{ role: "user", content: "Message 1" },
				{ role: "assistant", content: "Response 1" },
				{ role: "user", content: "Message 2" },
				{ role: "assistant", content: "Response 2" },
				{ role: "user", content: "Message 3" },
				{ role: "assistant", content: "Response 3" },
				{ role: "user", content: "Message 4" },
			] as any;

			const mockConversationManager = {
				get: vi.fn().mockResolvedValue(messages),
			};

			const mockProvider = {
				getResponse: vi.fn().mockResolvedValue({
					response: "Summary of recent conversation",
				}),
				name: "test-provider",
				supportsStreaming: false,
				createRealtimeSession: vi.fn(),
			};
			vi.mocked(chatCapability.getChatProvider).mockReturnValue(mockProvider);

			const manager = MemoryManager.getInstance(mockEnv, mockUser);

			vi.spyOn(manager, "storeMemory").mockResolvedValue("mock-id");

			const result = await manager.handleMemory(
				"test message",
				messages,
				mockConversationManager as any,
				"completion-123",
				userSettings as any,
			);

			expect(result).toEqual([
				{
					type: "snapshot",
					text: "Summary of recent conversation",
					category: "snapshot",
				},
			]);
		});

		it("should return empty array when both settings are disabled", async () => {
			const userSettings = {
				memories_save_enabled: false,
				memories_chat_history_enabled: false,
			};

			const messages = [{ role: "user", content: "test" }] as any;
			const mockConversationManager = { get: vi.fn() } as any;

			const manager = MemoryManager.getInstance(mockEnv, mockUser);

			const result = await manager.handleMemory(
				"test message",
				messages,
				mockConversationManager,
				"completion-123",
				userSettings as any,
			);

			expect(result).toEqual([]);
		});

		it("should handle AI provider errors gracefully", async () => {
			const userSettings = {
				memories_save_enabled: true,
				memories_chat_history_enabled: false,
			};

			const messages = [{ role: "user", content: "test" }] as any;

			const mockProvider = {
				getResponse: vi.fn().mockRejectedValue(new Error("AI API error")),
				name: "test-provider",
				supportsStreaming: false,
				createRealtimeSession: vi.fn(),
			};
			vi.mocked(chatCapability.getChatProvider).mockReturnValue(mockProvider);

			const manager = MemoryManager.getInstance(mockEnv, mockUser);
			const mockConversationManager = { get: vi.fn() } as any;

			const result = await manager.handleMemory(
				"test message",
				messages,
				mockConversationManager,
				"completion-123",
				userSettings as any,
			);

			expect(result).toEqual([]);
		});
	});
});
