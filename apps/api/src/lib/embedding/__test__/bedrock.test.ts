import { AwsClient } from "aws4fetch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UserSettingsRepository } from "~/repositories/UserSettingsRepository";
import { AssistantError } from "~/utils/errors";
import { BedrockEmbeddingProvider } from "../bedrock";

vi.mock("aws4fetch");
vi.mock("~/repositories/UserSettingsRepository");

describe("BedrockEmbeddingProvider", () => {
	let provider: BedrockEmbeddingProvider;
	let mockEnv: any;
	let mockUser: any;
	let mockAwsClient: any;
	let mockUserSettingsRepo: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockEnv = {
			DB: {},
			AWS_REGION: "us-east-1",
			BEDROCK_AWS_ACCESS_KEY: "default-access-key",
			BEDROCK_AWS_SECRET_KEY: "default-secret-key",
		};

		mockUser = {
			id: 123,
			email: "test@example.com",
		};

		mockAwsClient = {
			fetch: vi.fn(),
		};

		mockUserSettingsRepo = {
			getProviderApiKey: vi.fn(),
		};

		vi.mocked(AwsClient).mockImplementation(() => mockAwsClient);
		vi.mocked(UserSettingsRepository).mockImplementation(
			() => mockUserSettingsRepo,
		);

		provider = new BedrockEmbeddingProvider(
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

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("constructor", () => {
		it("should initialize with required configuration", () => {
			expect(provider).toBeDefined();
		});

		it("should use default region if not provided", () => {
			const providerWithDefaults = new BedrockEmbeddingProvider(
				{
					knowledgeBaseId: "test-kb-id",
					accessKeyId: "test-access-key",
					secretAccessKey: "test-secret-key",
				},
				mockEnv,
			);
			expect(providerWithDefaults).toBeDefined();
		});
	});

	describe("parseAwsCredentials", () => {
		it("should parse valid AWS credentials format", () => {
			const result = (provider as any).parseAwsCredentials(
				"access-key::@@::secret-key",
			);
			expect(result).toEqual({
				accessKey: "access-key",
				secretKey: "secret-key",
			});
		});

		it("should throw error for invalid credentials format", () => {
			expect(() => {
				(provider as any).parseAwsCredentials("invalid-format");
			}).toThrow(expect.any(AssistantError));
		});

		it("should throw error for missing delimiter", () => {
			expect(() => {
				(provider as any).parseAwsCredentials("access-key-secret-key");
			}).toThrow(expect.any(AssistantError));
		});
	});

	describe("getAwsClient", () => {
		it("should use default credentials when no user API key is found", async () => {
			mockUserSettingsRepo.getProviderApiKey.mockResolvedValue(null);

			const client = await provider.getAwsClient();

			expect(client).toBeDefined();
			expect(AwsClient).toHaveBeenCalledWith({
				accessKeyId: "test-access-key",
				secretAccessKey: "test-secret-key",
				region: "us-east-1",
				service: "bedrock",
			});
		});

		it("should use user API key when available", async () => {
			mockUserSettingsRepo.getProviderApiKey.mockResolvedValue(
				"user-access::@@::user-secret",
			);

			const client = await provider.getAwsClient();

			expect(client).toBeDefined();
			expect(AwsClient).toHaveBeenCalledWith({
				accessKeyId: "user-access",
				secretAccessKey: "user-secret",
				region: "us-east-1",
				service: "bedrock",
			});
		});

		it("should throw error when no valid credentials are found", async () => {
			const providerWithoutCreds = new BedrockEmbeddingProvider(
				{
					knowledgeBaseId: "test-kb-id",
					accessKeyId: "",
					secretAccessKey: "",
				},
				mockEnv,
				mockUser,
			);

			mockUserSettingsRepo.getProviderApiKey.mockResolvedValue(null);

			await expect(providerWithoutCreds.getAwsClient()).rejects.toThrow(
				AssistantError,
			);
		});

		it("should handle user settings repository errors gracefully", async () => {
			mockUserSettingsRepo.getProviderApiKey.mockRejectedValue(
				new Error("DB error"),
			);

			const client = await provider.getAwsClient();

			expect(client).toBeDefined();
		});
	});

	describe("generate", () => {
		it("should generate embedding vector with metadata", async () => {
			const result = await provider.generate(
				"article",
				"test content",
				"test-id",
				{ title: "Test" },
			);

			expect(result).toEqual([
				{
					id: "test-id",
					values: [],
					metadata: {
						title: "Test",
						type: "article",
						content: "test content",
					},
				},
			]);
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
	});

	describe("insert", () => {
		it("should successfully insert embeddings", async () => {
			mockAwsClient.fetch.mockResolvedValue({
				ok: true,
				status: 200,
			});

			const embeddings = [
				{
					id: "test-id",
					values: [0.1, 0.2, 0.3],
					metadata: { content: "test content", type: "article" },
				},
			];

			const result = await provider.insert(embeddings);

			expect(result).toEqual({
				status: "success",
				error: null,
			});
			expect(mockAwsClient.fetch).toHaveBeenCalledWith(
				expect.stringContaining(
					"/knowledgebases/test-kb-id/datasources/test-ds-id/documents",
				),
				expect.objectContaining({
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: expect.any(String),
				}),
			);
		});

		it("should throw error when API request fails", async () => {
			mockAwsClient.fetch.mockResolvedValue({
				ok: false,
				status: 400,
				statusText: "Bad Request",
				text: () => Promise.resolve("Invalid request"),
			});

			const embeddings = [
				{
					id: "test-id",
					values: [0.1, 0.2, 0.3],
					metadata: { content: "test content", type: "article" },
				},
			];

			await expect(provider.insert(embeddings)).rejects.toThrow(
				expect.any(AssistantError),
			);
		});
	});

	describe("delete", () => {
		it("should return not implemented error", async () => {
			const result = await provider.delete(["id1", "id2"]);

			expect(result).toEqual({
				status: "error",
				error: "Not implemented",
			});
		});
	});

	describe("getQuery", () => {
		it("should return query with success status", async () => {
			const result = await provider.getQuery("test query");

			expect(result).toEqual({
				data: "test query",
				status: { success: true },
			});
		});
	});

	describe("getMatches", () => {
		it("should successfully retrieve matches", async () => {
			mockAwsClient.fetch.mockClear();

			const mockResponse = {
				retrievalResults: [
					{
						title: "Test Article",
						content: { text: "Test content" },
						location: { type: "document" },
						score: 0.95,
						metadata: { author: "Test Author" },
					},
				],
			};

			mockAwsClient.fetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await provider.getMatches("test query");
			const [, request] = mockAwsClient.fetch.mock.calls[0];
			expect(request).toMatchObject({
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			expect(JSON.parse(request.body)).toEqual({
				retrievalQuery: { text: "test query" },
			});

			expect(result).toEqual({
				matches: [
					{
						title: "Test Article",
						content: "Test content",
						id: "document",
						score: 0.95,
						metadata: {
							author: "Test Author",
							location: { type: "document" },
						},
					},
				],
				count: 1,
			});
		});

		it("should include retrieval configuration when options are provided", async () => {
			mockAwsClient.fetch.mockClear();

			const mockResponse = {
				retrievalResults: [
					{
						title: "Test Article",
						content: { text: "Test content" },
						location: { type: "document" },
						score: 0.95,
						metadata: { author: "Test Author" },
					},
				],
			};

			mockAwsClient.fetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const options = {
				topK: 7,
				type: "hybrid",
				filter: { equals: { key: "type", value: { stringValue: "doc" } } },
			} as const;

			await provider.getMatches("test query", options);

			const calls = mockAwsClient.fetch.mock.calls;
			const [, request] = calls[calls.length - 1];
			expect(JSON.parse(request.body)).toEqual({
				retrievalQuery: { text: "test query" },
				retrievalConfiguration: {
					knowledgeBaseRetrievalConfiguration: {
						vectorSearchConfiguration: {
							numberOfResults: 7,
							overrideSearchType: "HYBRID",
							filter: options.filter,
						},
					},
				},
			});
		});

		it("should throw error when API request fails", async () => {
			mockAwsClient.fetch.mockClear();

			mockAwsClient.fetch.mockResolvedValue({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				text: () => Promise.resolve("Server error"),
			});

			await expect(provider.getMatches("test query")).rejects.toThrow(
				AssistantError,
			);
		});
	});

	describe("searchSimilar", () => {
		it("should return formatted search results", async () => {
			mockAwsClient.fetch.mockClear();

			const mockResponse = {
				retrievalResults: [
					{
						title: "Test Article",
						content: { text: "Test content" },
						location: { type: "document" },
						score: 0.95,
						metadata: { type: "article", author: "Test Author" },
					},
				],
			};

			mockAwsClient.fetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const result = await provider.searchSimilar("test query");

			expect(result).toEqual([
				{
					title: "Test Article",
					content: "Test content",
					metadata: {
						type: "article",
						author: "Test Author",
						location: { type: "document" },
					},
					score: 0.95,
					type: "article",
				},
			]);
		});

		it("should forward options to getMatches", async () => {
			const getMatchesSpy = vi
				.spyOn(provider as any, "getMatches")
				.mockResolvedValue({
					matches: [
						{
							title: "t",
							content: "c",
							metadata: {},
							score: 1,
						},
					],
					count: 1,
				});

			const options = { topK: 5 };

			await provider.searchSimilar("test query", options);

			expect(getMatchesSpy).toHaveBeenCalledWith("test query", options);
		});

		it("should throw error when no matches found", async () => {
			mockAwsClient.fetch.mockClear();

			mockAwsClient.fetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ retrievalResults: [] }),
			});

			await expect(provider.searchSimilar("test query")).rejects.toThrow(
				AssistantError,
			);
		});
	});
});
