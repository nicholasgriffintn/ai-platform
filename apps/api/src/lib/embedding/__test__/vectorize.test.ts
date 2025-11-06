import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";
import { VectorizeEmbeddingProvider } from "../vectorize";

describe("VectorizeEmbeddingProvider", () => {
	let provider: VectorizeEmbeddingProvider;
	let mockAi: any;
	let mockVectorDb: any;
	let mockRepositories: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockAi = {
			run: vi.fn(),
		};

		mockVectorDb = {
			upsert: vi.fn(),
			deleteByIds: vi.fn(),
			query: vi.fn(),
		};

		mockRepositories = {
			embeddings: {
				getEmbedding: vi.fn(),
			},
		};

		provider = new VectorizeEmbeddingProvider({
			ai: mockAi,
			vector_db: mockVectorDb,
			repositories: mockRepositories,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("constructor", () => {
		it("should initialize with required configuration", () => {
			expect(provider).toBeDefined();
		});
	});

	describe("generate", () => {
		it("should generate embedding vectors successfully", async () => {
			mockAi.run.mockResolvedValue({
				data: [[0.1, 0.2, 0.3, 0.4, 0.5]],
			});

			const result = await provider.generate(
				"article",
				"test content",
				"test-id",
				{ title: "Test Article" },
			);

			expect(result).toEqual([
				{
					id: "test-id",
					values: [0.1, 0.2, 0.3, 0.4, 0.5],
					metadata: {
						title: "Test Article",
						type: "article",
					},
				},
			]);

			expect(mockAi.run).toHaveBeenCalledWith(
				"@cf/baai/bge-large-en-v1.5",
				{ text: ["test content"] },
				{
					gateway: {
						id: "llm-assistant",
						skipCache: false,
						cacheTtl: 259200,
					},
				},
			);
		});

		it("should throw error for missing type", async () => {
			await expect(provider.generate("", "content", "id", {})).rejects.toThrow(
				AssistantError,
			);
		});

		it("should throw error for missing content", async () => {
			await expect(provider.generate("type", "", "id", {})).rejects.toThrow(
				AssistantError,
			);
		});

		it("should throw error for missing id", async () => {
			await expect(
				provider.generate("type", "content", "", {}),
			).rejects.toThrow(expect.any(AssistantError));
		});

		it("should throw error when AI returns no data", async () => {
			mockAi.run.mockResolvedValue({});

			await expect(
				provider.generate("article", "test content", "test-id", {}),
			).rejects.toThrow(expect.any(AssistantError));
		});

		it("should handle AI API errors", async () => {
			mockAi.run.mockRejectedValue(new Error("AI API error"));

			await expect(
				provider.generate("article", "test content", "test-id", {}),
			).rejects.toThrow();
		});
	});

	describe("insert", () => {
		it("should successfully insert embeddings", async () => {
			mockVectorDb.upsert.mockResolvedValue(undefined);

			const embeddings = [
				{
					id: "test-id",
					values: [0.1, 0.2, 0.3],
					metadata: { type: "article", title: "Test" },
				},
			];

			const result = await provider.insert(embeddings);

			expect(result).toEqual({
				status: "success",
				error: null,
			});

			expect(mockVectorDb.upsert).toHaveBeenCalledWith([
				{
					id: "test-id",
					values: [0.1, 0.2, 0.3],
					metadata: { type: "article", title: "Test" },
					namespace: "assistant-embeddings",
				},
			]);
		});

		it("should use custom namespace when provided", async () => {
			mockVectorDb.upsert.mockResolvedValue(undefined);

			const embeddings = [
				{
					id: "test-id",
					values: [0.1, 0.2, 0.3],
					metadata: { type: "article" },
				},
			];

			await provider.insert(embeddings, { namespace: "custom-namespace" });

			expect(mockVectorDb.upsert).toHaveBeenCalledWith([
				{
					id: "test-id",
					values: [0.1, 0.2, 0.3],
					metadata: { type: "article" },
					namespace: "custom-namespace",
				},
			]);
		});

		it("should handle vector database errors", async () => {
			mockVectorDb.upsert.mockRejectedValue(new Error("Vector DB error"));

			const embeddings = [
				{
					id: "test-id",
					values: [0.1, 0.2, 0.3],
					metadata: { type: "article" },
				},
			];

			await expect(provider.insert(embeddings)).rejects.toThrow(
				"Vector DB error",
			);
		});
	});

	describe("delete", () => {
		it("should successfully delete embeddings by IDs", async () => {
			mockVectorDb.deleteByIds.mockResolvedValue(undefined);

			const result = await provider.delete(["id1", "id2", "id3"]);

			expect(result).toEqual({
				status: "success",
				error: null,
			});

			expect(mockVectorDb.deleteByIds).toHaveBeenCalledWith([
				"id1",
				"id2",
				"id3",
			]);
		});

		it("should handle vector database delete errors", async () => {
			mockVectorDb.deleteByIds.mockRejectedValue(new Error("Delete error"));

			await expect(provider.delete(["id1", "id2"])).rejects.toThrow(
				"Delete error",
			);
		});
	});

	describe("getQuery", () => {
		it("should generate query embedding successfully", async () => {
			mockAi.run.mockResolvedValue({
				data: [[0.1, 0.2, 0.3, 0.4, 0.5]],
			});

			const result = await provider.getQuery("test query");

			expect(result).toEqual({
				data: [[0.1, 0.2, 0.3, 0.4, 0.5]],
				status: { success: true },
			});

			expect(mockAi.run).toHaveBeenCalledWith(
				"@cf/baai/bge-large-en-v1.5",
				{ text: ["test query"] },
				{
					gateway: {
						id: "llm-assistant",
						skipCache: false,
						cacheTtl: 259200,
					},
				},
			);
		});

		it("should handle AI API errors in getQuery", async () => {
			mockAi.run.mockRejectedValue(new Error("AI API error"));

			await expect(provider.getQuery("test query")).rejects.toThrow(
				"AI API error",
			);
		});
	});

	describe("getMatches", () => {
		it("should successfully retrieve matches", async () => {
			const mockMatches = {
				matches: [
					{
						id: "match1",
						score: 0.95,
						metadata: { type: "article", title: "Test Article" },
					},
					{
						id: "match2",
						score: 0.87,
						metadata: { type: "note", title: "Test Note" },
					},
				],
			};

			mockVectorDb.query.mockResolvedValue(mockMatches);

			const queryVector = [0.1, 0.2, 0.3, 0.4, 0.5] as any;
			const result = await provider.getMatches(queryVector);

			expect(result).toEqual({
				matches: [
					{
						id: "match1",
						score: 0.95,
						metadata: { type: "article", title: "Test Article" },
					},
					{
						id: "match2",
						score: 0.87,
						metadata: { type: "note", title: "Test Note" },
					},
				],
				count: 2,
			});

			expect(mockVectorDb.query).toHaveBeenCalledWith(queryVector, {
				topK: 15,
				returnValues: false,
				returnMetadata: "none",
				namespace: "assistant-embeddings",
			});
		});

		it("should use custom options when provided", async () => {
			mockVectorDb.query.mockResolvedValue({ matches: [] });

			const queryVector = [0.1, 0.2, 0.3] as any;
			await provider.getMatches(queryVector, {
				topK: 5,
				returnValues: true,
				returnMetadata: "all",
				namespace: "custom-namespace",
			});

			expect(mockVectorDb.query).toHaveBeenCalledWith(queryVector, {
				topK: 5,
				returnValues: true,
				returnMetadata: "all",
				namespace: "custom-namespace",
			});
		});

		it("should handle empty matches", async () => {
			mockVectorDb.query.mockResolvedValue({ matches: null });

			const queryVector = [0.1, 0.2, 0.3] as any;
			const result = await provider.getMatches(queryVector);

			expect(result).toEqual({
				matches: [],
				count: 0,
			});
		});
	});

	describe("searchSimilar", () => {
		it("should perform complete search with content retrieval", async () => {
			mockAi.run.mockResolvedValue({
				data: [[0.1, 0.2, 0.3, 0.4, 0.5]],
			});

			mockVectorDb.query.mockResolvedValue({
				matches: [
					{
						id: "match1",
						score: 0.95,
						metadata: { type: "article" },
					},
				],
			});

			mockRepositories.embeddings.getEmbedding.mockResolvedValue({
				id: "doc1",
				title: "Test Article",
				content: "Test content",
				metadata: { author: "Test Author" },
				type: "article",
			});

			const result = await provider.searchSimilar("test query");

			expect(result).toEqual([
				{
					match_id: "match1",
					id: "doc1",
					title: "Test Article",
					content: "Test content",
					metadata: {
						type: "article",
						author: "Test Author",
					},
					score: 0.95,
					type: "article",
				},
			]);
		});

		it("should filter matches by score threshold", async () => {
			mockAi.run.mockResolvedValue({
				data: [[0.1, 0.2, 0.3, 0.4, 0.5]],
			});

			mockVectorDb.query.mockResolvedValue({
				matches: [
					{ id: "match1", score: 0.95, metadata: {} },
					{ id: "match2", score: 0.6, metadata: {} },
					{ id: "match3", score: 0.4, metadata: {} },
				],
			});

			mockRepositories.embeddings.getEmbedding.mockResolvedValue({
				id: "doc1",
				title: "Test",
				content: "Content",
				type: "article",
			});

			const result = await provider.searchSimilar("test query", {
				scoreThreshold: 0.7,
				topK: 2,
			});

			expect(result).toHaveLength(1);
			expect(result[0].score).toBe(0.95);
		});

		it("should throw error when no embedding data found", async () => {
			mockAi.run.mockResolvedValue({});

			await expect(provider.searchSimilar("test query")).rejects.toThrow(
				AssistantError,
			);
		});

		it("should throw error when no matches found", async () => {
			mockAi.run.mockResolvedValue({
				data: [[0.1, 0.2, 0.3, 0.4, 0.5]],
			});

			mockVectorDb.query.mockResolvedValue({
				matches: [],
			});

			await expect(provider.searchSimilar("test query")).rejects.toThrow(
				AssistantError,
			);
		});

		it("should handle database retrieval errors gracefully", async () => {
			mockAi.run.mockResolvedValue({
				data: [[0.1, 0.2, 0.3, 0.4, 0.5]],
			});

			mockVectorDb.query.mockResolvedValue({
				matches: [{ id: "match1", score: 0.95, metadata: { type: "article" } }],
			});

			mockRepositories.embeddings.getEmbedding.mockRejectedValue(
				new Error("DB error"),
			);

			await expect(provider.searchSimilar("test query")).rejects.toThrow(
				"DB error",
			);
		});
	});
});
