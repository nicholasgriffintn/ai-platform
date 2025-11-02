import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError, ErrorType } from "~/utils/errors";
import { BedrockEmbeddingProvider } from "../bedrock";
import { EmbeddingProviderFactory } from "../factory";
import { MistralEmbeddingProvider } from "../mistral";
import { VectorizeEmbeddingProvider } from "../vectorize";

vi.mock("../bedrock");
vi.mock("../mistral");
vi.mock("../vectorize");

describe("EmbeddingProviderFactory", () => {
	let mockEnv: any;
	let mockUser: any;

	beforeEach(() => {
		vi.clearAllMocks();

		mockEnv = {
			AWS_REGION: "us-east-1",
			BEDROCK_AWS_ACCESS_KEY: "test-access-key",
			BEDROCK_AWS_SECRET_KEY: "test-secret-key",
			AI: {},
			VECTOR_DB: {},
		};

		mockUser = {
			id: 123,
			email: "test@example.com",
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("getProvider", () => {
		it("should create BedrockEmbeddingProvider for bedrock type", () => {
			const config = {
				knowledgeBaseId: "test-kb-id",
				knowledgeBaseCustomDataSourceId: "test-ds-id",
				region: "us-east-1",
				accessKeyId: "test-access-key",
				secretAccessKey: "test-secret-key",
			};

			const provider = EmbeddingProviderFactory.getProvider(
				"bedrock",
				config,
				mockEnv,
				mockUser,
			);

			expect(BedrockEmbeddingProvider).toHaveBeenCalledWith(
				config,
				mockEnv,
				mockUser,
			);
			expect(provider).toBeInstanceOf(BedrockEmbeddingProvider);
		});

		it("should create VectorizeEmbeddingProvider for vectorize type", () => {
			const config = {
				ai: mockEnv.AI,
				vector_db: mockEnv.VECTOR_DB,
				database: {} as any,
			};

			const provider = EmbeddingProviderFactory.getProvider(
				"vectorize",
				config,
				mockEnv,
				mockUser,
			);

			expect(VectorizeEmbeddingProvider).toHaveBeenCalledWith(config);
			expect(provider).toBeInstanceOf(VectorizeEmbeddingProvider);
		});

		it("should create MistralEmbeddingProvider for mistral type", () => {
			const config = {
				vector_db: mockEnv.VECTOR_DB,
			};

			const provider = EmbeddingProviderFactory.getProvider(
				"mistral",
				config,
				mockEnv,
				mockUser,
			);

			expect(MistralEmbeddingProvider).toHaveBeenCalledWith(
				config,
				mockEnv,
				mockUser,
			);
			expect(provider).toBeInstanceOf(MistralEmbeddingProvider);
		});

		it("should create BedrockEmbeddingProvider without user", () => {
			const config = {
				knowledgeBaseId: "test-kb-id",
				accessKeyId: "test-access-key",
				secretAccessKey: "test-secret-key",
			};

			const provider = EmbeddingProviderFactory.getProvider(
				"bedrock",
				config,
				mockEnv,
			);

			expect(BedrockEmbeddingProvider).toHaveBeenCalledWith(
				config,
				mockEnv,
				undefined,
			);
			expect(provider).toBeInstanceOf(BedrockEmbeddingProvider);
		});

		it("should throw error for invalid bedrock config", () => {
			const invalidConfig = {
				ai: mockEnv.AI,
				vector_db: mockEnv.VECTOR_DB,
			} as any;

			expect(() => {
				EmbeddingProviderFactory.getProvider(
					"bedrock",
					invalidConfig,
					mockEnv,
					mockUser,
				);
			}).toThrow(expect.any(AssistantError));
		});

		it("should throw error for invalid vectorize config", () => {
			const invalidConfig = {
				knowledgeBaseId: "test-kb-id",
				accessKeyId: "test-access-key",
				secretAccessKey: "test-secret-key",
			} as any;

			expect(() => {
				EmbeddingProviderFactory.getProvider(
					"vectorize",
					invalidConfig,
					mockEnv,
					mockUser,
				);
			}).toThrow(expect.any(AssistantError));
		});

		it("should throw error for unsupported provider type", () => {
			const config = {
				knowledgeBaseId: "test-kb-id",
				accessKeyId: "test-access-key",
				secretAccessKey: "test-secret-key",
			};

			expect(() => {
				EmbeddingProviderFactory.getProvider(
					"unsupported",
					config as any,
					mockEnv,
					mockUser,
				);
			}).toThrow(expect.any(AssistantError));
		});

		it("should throw error with correct error type for unsupported provider", () => {
			const config = {} as any;

			try {
				EmbeddingProviderFactory.getProvider(
					"invalid",
					config,
					mockEnv,
					mockUser,
				);
			} catch (error) {
				expect(error).toBeInstanceOf(AssistantError);
				expect((error as AssistantError).type).toBe(ErrorType.PARAMS_ERROR);
			}
		});

		it("should throw error with correct error type for invalid bedrock config", () => {
			const invalidConfig = {
				ai: mockEnv.AI,
			} as any;

			try {
				EmbeddingProviderFactory.getProvider(
					"bedrock",
					invalidConfig,
					mockEnv,
					mockUser,
				);
			} catch (error) {
				expect(error).toBeInstanceOf(AssistantError);
				expect((error as AssistantError).type).toBe(
					ErrorType.CONFIGURATION_ERROR,
				);
			}
		});

		it("should throw error with correct error type for invalid vectorize config", () => {
			const invalidConfig = {
				knowledgeBaseId: "test",
			} as any;

			try {
				EmbeddingProviderFactory.getProvider(
					"vectorize",
					invalidConfig,
					mockEnv,
					mockUser,
				);
			} catch (error) {
				expect(error).toBeInstanceOf(AssistantError);
				expect((error as AssistantError).type).toBe(
					ErrorType.CONFIGURATION_ERROR,
				);
			}
		});

		it("should throw error with correct error type for invalid mistral config", () => {
			const invalidConfig = {
				ai: mockEnv.AI,
			} as any;

			try {
				EmbeddingProviderFactory.getProvider(
					"mistral",
					invalidConfig,
					mockEnv,
					mockUser,
				);
			} catch (error) {
				expect(error).toBeInstanceOf(AssistantError);
				expect((error as AssistantError).type).toBe(
					ErrorType.CONFIGURATION_ERROR,
				);
			}
		});
	});
});
