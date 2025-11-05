import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Database } from "~/lib/database";
import { getAuxiliaryModel } from "~/lib/models";
import { trackRagMetrics } from "~/lib/monitoring";
import { AIProviderFactory } from "~/lib/providers/factory";
import { AssistantError } from "~/utils/errors";
import type { IUserSettings } from "../../../types";
import { EmbeddingProviderFactory } from "../factory";
import { Embedding } from "../index";

vi.mock("../factory");
vi.mock("~/lib/database");
vi.mock("~/lib/monitoring");
vi.mock("~/lib/providers/factory");
vi.mock("~/lib/models");

describe("Embedding", () => {
	let mockEnv: any;
	let mockUser: any;
	let mockUserSettings: any;
	let mockProvider: any;
	let mockDatabase: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockEnv = {
			DB: {} as any,
			AI: {},
			VECTOR_DB: {},
			AWS_REGION: "us-east-1",
			BEDROCK_AWS_ACCESS_KEY: "test-access-key",
			BEDROCK_AWS_SECRET_KEY: "test-secret-key",
			ANALYTICS: {},
		};

		mockUser = {
			id: 123,
			email: "test@example.com",
		};

		mockUserSettings = {
			embedding_provider: "vectorize",
		};

		mockProvider = {
			generate: vi.fn(),
			insert: vi.fn(),
			delete: vi.fn(),
			getQuery: vi.fn(),
			getMatches: vi.fn(),
			searchSimilar: vi.fn(),
		};

		mockDatabase = {
			getInstance: vi.fn().mockReturnValue({}),
		};

		vi.mocked(EmbeddingProviderFactory.getProvider).mockReturnValue(
			mockProvider,
		);
		vi.mocked(Database.getInstance).mockReturnValue(mockDatabase);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("constructor and singleton", () => {
		it("should create vectorize provider by default", () => {
			const embedding = Embedding.getInstance(
				mockEnv,
				mockUser,
				mockUserSettings,
			);

			expect(EmbeddingProviderFactory.getProvider).toHaveBeenCalledWith(
				"vectorize",
				{
					ai: mockEnv.AI,
					vector_db: mockEnv.VECTOR_DB,
					database: mockDatabase,
				},
				mockEnv,
				mockUser,
			);
			expect(embedding).toBeDefined();
		});

		it("should create bedrock provider when specified in user settings", () => {
			const bedrockSettings = {
				embedding_provider: "bedrock",
				bedrock_knowledge_base_id: "test-kb-id",
				bedrock_knowledge_base_custom_data_source_id: "test-ds-id",
			} as IUserSettings;

			const _embedding = Embedding.getInstance(
				mockEnv,
				mockUser,
				bedrockSettings,
			);

			expect(EmbeddingProviderFactory.getProvider).toHaveBeenCalledWith(
				"bedrock",
				{
					knowledgeBaseId: "test-kb-id",
					knowledgeBaseCustomDataSourceId: "test-ds-id",
					region: "us-east-1",
					accessKeyId: "test-access-key",
					secretAccessKey: "test-secret-key",
				},
				mockEnv,
				mockUser,
			);
		});

		it("should create mistral provider when specified in user settings", () => {
			const mistralSettings = {
				embedding_provider: "mistral",
			} as IUserSettings;

			Embedding.getInstance(mockEnv, mockUser, mistralSettings);

			expect(EmbeddingProviderFactory.getProvider).toHaveBeenCalledWith(
				"mistral",
				{
					vector_db: mockEnv.VECTOR_DB,
				},
				mockEnv,
				mockUser,
			);
			expect(Database.getInstance).not.toHaveBeenCalled();
		});

		it("should throw error for bedrock without required credentials", () => {
			const incompleteBedrockSettings = {
				embedding_provider: "bedrock",
			} as IUserSettings;

			expect(() => {
				Embedding.getInstance(mockEnv, mockUser, incompleteBedrockSettings);
			}).toThrow(expect.any(AssistantError));
		});

		it("should return new instance on each call", () => {
			const embedding1 = Embedding.getInstance(
				mockEnv,
				mockUser,
				mockUserSettings,
			);
			const embedding2 = Embedding.getInstance(
				mockEnv,
				mockUser,
				mockUserSettings,
			);

			expect(embedding1).not.toBe(embedding2);
		});
	});

	describe("getNamespace", () => {
		let embedding: Embedding;

		beforeEach(() => {
			embedding = Embedding.getInstance(mockEnv, mockUser, mockUserSettings);
		});

		it("should return provided namespace when valid", () => {
			const result = embedding.getNamespace({ namespace: "custom-namespace" });
			expect(result).toBe("custom-namespace");
		});

		it("should return kb for user-specific namespace without user ID match", () => {
			const result = embedding.getNamespace({ namespace: "user_kb_456" });
			expect(result).toBe("kb");
		});

		it("should return original namespace for user-specific namespace with matching user ID", () => {
			const result = embedding.getNamespace({ namespace: "user_kb_123" });
			expect(result).toBe("user_kb_123");
		});

		it("should return kb for memory namespace without user ID match", () => {
			const result = embedding.getNamespace({ namespace: "memory_user_456" });
			expect(result).toBe("kb");
		});

		it("should return user-specific namespace when user exists and no namespace provided", () => {
			const result = embedding.getNamespace();
			expect(result).toBe("user_kb_123");
		});

		it("should return default kb namespace when no user and no namespace", () => {
			const embeddingWithoutUser = Embedding.getInstance(mockEnv);
			const result = embeddingWithoutUser.getNamespace();
			expect(result).toBe("kb");
		});
	});

	describe("generate", () => {
		let embedding: Embedding;

		beforeEach(() => {
			embedding = Embedding.getInstance(mockEnv, mockUser, mockUserSettings);
		});

		it("should call provider generate method", async () => {
			const mockResult = [{ id: "test-id", values: [0.1, 0.2], metadata: {} }];
			mockProvider.generate.mockResolvedValue(mockResult);

			const result = await embedding.generate(
				"article",
				"test content",
				"test-id",
				{ title: "Test" },
			);

			expect(mockProvider.generate).toHaveBeenCalledWith(
				"article",
				"test content",
				"test-id",
				{ title: "Test" },
			);
			expect(result).toEqual(mockResult);
		});
	});

	describe("insert", () => {
		let embedding: Embedding;

		beforeEach(() => {
			embedding = Embedding.getInstance(mockEnv, mockUser, mockUserSettings);
		});

		it("should call provider insert with namespace", async () => {
			const mockEmbeddings = [
				{ id: "test-id", values: [0.1, 0.2], metadata: {} },
			];
			const mockResult = { status: "success", error: null };
			mockProvider.insert.mockResolvedValue(mockResult);

			const result = await embedding.insert(mockEmbeddings);

			expect(mockProvider.insert).toHaveBeenCalledWith(mockEmbeddings, {
				namespace: "user_kb_123",
			});
			expect(result).toEqual(mockResult);
		});

		it("should use custom namespace when provided", async () => {
			const mockEmbeddings = [
				{ id: "test-id", values: [0.1, 0.2], metadata: {} },
			];
			mockProvider.insert.mockResolvedValue({ status: "success", error: null });

			await embedding.insert(mockEmbeddings, { namespace: "custom-namespace" });

			expect(mockProvider.insert).toHaveBeenCalledWith(mockEmbeddings, {
				namespace: "custom-namespace",
			});
		});
	});

	describe("delete", () => {
		let embedding: Embedding;

		beforeEach(() => {
			embedding = Embedding.getInstance(mockEnv, mockUser, mockUserSettings);
		});

		it("should call provider delete method", async () => {
			const mockResult = { status: "success", error: null };
			mockProvider.delete.mockResolvedValue(mockResult);

			const result = await embedding.delete(["id1", "id2"]);

			expect(mockProvider.delete).toHaveBeenCalledWith(["id1", "id2"]);
			expect(result).toEqual(mockResult);
		});
	});

	describe("getQuery", () => {
		let embedding: Embedding;

		beforeEach(() => {
			embedding = Embedding.getInstance(mockEnv, mockUser, mockUserSettings);
		});

		it("should call provider getQuery method", async () => {
			const mockResult = { data: [0.1, 0.2, 0.3], status: { success: true } };
			mockProvider.getQuery.mockResolvedValue(mockResult);

			const result = await embedding.getQuery("test query");

			expect(mockProvider.getQuery).toHaveBeenCalledWith("test query");
			expect(result).toEqual(mockResult);
		});
	});

	describe("getMatches", () => {
		let embedding: Embedding;

		beforeEach(() => {
			embedding = Embedding.getInstance(mockEnv, mockUser, mockUserSettings);
		});

		it("should call provider getMatches with namespace", async () => {
			const mockQueryVector = [0.1, 0.2, 0.3] as any;
			const mockResult = { matches: [], count: 0 };
			mockProvider.getMatches.mockResolvedValue(mockResult);

			const result = await embedding.getMatches(mockQueryVector);

			expect(mockProvider.getMatches).toHaveBeenCalledWith(mockQueryVector, {
				namespace: "user_kb_123",
			});
			expect(result).toEqual(mockResult);
		});
	});

	describe("searchSimilar", () => {
		let embedding: Embedding;

		beforeEach(() => {
			embedding = Embedding.getInstance(mockEnv, mockUser, mockUserSettings);
		});

		it("should call provider searchSimilar with namespace", async () => {
			const mockResult = [
				{ id: "doc1", title: "Test", content: "Content", score: 0.9 },
			];
			mockProvider.searchSimilar.mockResolvedValue(mockResult);

			const result = await embedding.searchSimilar("test query");

			expect(mockProvider.searchSimilar).toHaveBeenCalledWith("test query", {
				namespace: "user_kb_123",
			});
			expect(result).toEqual(mockResult);
		});
	});

	describe("augmentPrompt", () => {
		let embedding: Embedding;
		let mockAiProvider: any;

		beforeEach(() => {
			embedding = Embedding.getInstance(mockEnv, mockUser, mockUserSettings);

			mockAiProvider = {
				getResponse: vi.fn(),
			};

			vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockAiProvider);
			vi.mocked(getAuxiliaryModel).mockResolvedValue({
				model: "test-model",
				provider: "test-provider",
			});
			vi.mocked(trackRagMetrics).mockImplementation((fn) => fn());
		});

		it("should return original query when no documents found", async () => {
			mockProvider.searchSimilar.mockResolvedValue([]);

			const result = await embedding.augmentPrompt(
				"test query",
				{},
				mockEnv,
				123,
			);

			expect(result).toBe("test query");
		});

		it("should augment prompt with retrieved documents", async () => {
			const mockDocs = [
				{
					id: "doc1",
					title: "Test Article",
					content: "Test content",
					score: 0.9,
					type: "article",
				},
			];

			mockProvider.searchSimilar.mockResolvedValue(mockDocs);

			const result = await embedding.augmentPrompt(
				"test query",
				{},
				mockEnv,
				123,
			);

			expect(result).toContain("test query");
			expect(result).toContain("Test Article");
			expect(result).toContain("Test content");
			expect(mockProvider.searchSimilar).toHaveBeenCalledWith("test query", {
				topK: 10,
				scoreThreshold: 0.7,
				type: undefined,
				namespace: "user_kb_123",
			});
		});

		it("should use topK=1 for short queries", async () => {
			const mockDocs = [
				{
					id: "doc1",
					title: "Test",
					content: "Content",
					score: 0.9,
					type: "article",
				},
			];
			mockProvider.searchSimilar.mockResolvedValue(mockDocs);

			await embedding.augmentPrompt("short", {}, mockEnv, 123);

			expect(mockProvider.searchSimilar).toHaveBeenCalledWith("short", {
				topK: 10,
				scoreThreshold: 0.7,
				type: undefined,
				namespace: "user_kb_123",
			});
		});

		it("should handle reranking when multiple documents are returned", async () => {
			const mockDocs = [
				{
					id: "doc1",
					title: "Test 1",
					content: "Content 1",
					score: 0.9,
					type: "article",
				},
				{
					id: "doc2",
					title: "Test 2",
					content: "Content 2",
					score: 0.8,
					type: "article",
				},
			];

			mockProvider.searchSimilar.mockResolvedValue(mockDocs);
			mockAiProvider.getResponse.mockResolvedValue({
				content: '["doc2", "doc1"]',
			});

			const result = await embedding.augmentPrompt(
				"test query",
				{ topK: 1 },
				mockEnv,
				123,
			);

			expect(AIProviderFactory.getProvider).toHaveBeenCalledWith("workers");
			expect(result).toContain("Test 2");
		});

		it("should handle content summarization for long documents", async () => {
			const mockDocs = [
				{
					id: "doc1",
					title: "Test Article",
					content:
						"Very long content that exceeds the summary threshold".repeat(20),
					score: 0.9,
					type: "article",
				},
			];

			mockProvider.searchSimilar.mockResolvedValue(mockDocs);
			mockAiProvider.getResponse.mockResolvedValue({
				content: "Summarized content",
			});

			const result = await embedding.augmentPrompt(
				"test query",
				{},
				mockEnv,
				123,
			);

			expect(result).toContain("Summarized content");
		});

		it("should handle errors gracefully and return original query", async () => {
			mockProvider.searchSimilar.mockRejectedValue(new Error("Search failed"));

			const result = await embedding.augmentPrompt(
				"test query",
				{},
				mockEnv,
				123,
			);

			expect(result).toBe("test query");
		});

		it("should handle reranking errors gracefully", async () => {
			const mockDocs = [
				{
					id: "doc1",
					title: "Test 1",
					content: "Content 1",
					score: 0.9,
					type: "article",
				},
				{
					id: "doc2",
					title: "Test 2",
					content: "Content 2",
					score: 0.8,
					type: "article",
				},
			];

			mockProvider.searchSimilar.mockResolvedValue(mockDocs);
			mockAiProvider.getResponse.mockRejectedValue(new Error("Rerank failed"));

			const result = await embedding.augmentPrompt(
				"test query",
				{ topK: 1 },
				mockEnv,
				123,
			);

			expect(result).toContain("Content 1");
		});

		it("should handle invalid rerank response gracefully", async () => {
			const mockDocs = [
				{
					id: "doc1",
					title: "Test 1",
					content: "Content 1",
					score: 0.9,
					type: "article",
				},
				{
					id: "doc2",
					title: "Test 2",
					content: "Content 2",
					score: 0.8,
					type: "article",
				},
			];

			mockProvider.searchSimilar.mockResolvedValue(mockDocs);
			mockAiProvider.getResponse.mockResolvedValue({ content: "invalid json" });

			const result = await embedding.augmentPrompt(
				"test query",
				{ topK: 1 },
				mockEnv,
				123,
			);

			expect(result).toContain("test query");
			expect(result).toContain("[]");
		});

		it("should handle summarization errors gracefully", async () => {
			const mockDocs = [
				{
					id: "doc1",
					title: "Test Article",
					content:
						"Very long content that exceeds the summary threshold".repeat(20),
					score: 0.9,
					type: "article",
				},
			];

			mockProvider.searchSimilar.mockResolvedValue(mockDocs);
			mockAiProvider.getResponse.mockRejectedValue(
				new Error("Summarization failed"),
			);

			const result = await embedding.augmentPrompt(
				"test query",
				{},
				mockEnv,
				123,
			);

			expect(result).toContain("Very long content");
		});
	});
});
