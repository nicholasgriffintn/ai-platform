import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleCountTokens } from "../countTokens";
import type { IEnv, IUser, Message } from "~/types";

vi.mock("~/lib/models", () => ({
	getModelConfigByModel: vi.fn(),
}));

vi.mock("~/lib/providers/factory", () => ({
	AIProviderFactory: {
		getProvider: vi.fn(),
	},
}));

vi.mock("~/utils/logger", () => ({
	getLogger: vi.fn(() => ({
		info: vi.fn(),
		error: vi.fn(),
	})),
}));

const createMockModelConfig = (
	provider: string,
	matchingModel: string,
	supportsTokenCounting = true,
) =>
	({
		provider,
		matchingModel,
		type: ["text"],
		name: "Test Model",
		supportsTokenCounting,
	}) as any;

const createMockProvider = (hasCountTokens = true, inputTokens = 42) =>
	({
		name: "test-provider",
		supportsStreaming: true,
		getResponse: vi.fn(),
		createRealtimeSession: vi.fn(),
		...(hasCountTokens && {
			countTokens: vi.fn().mockResolvedValue({ inputTokens }),
		}),
	}) as any;

describe("countTokens", () => {
	let mockEnv: IEnv;
	let mockUser: IUser;
	let mockMessages: Message[];

	beforeEach(() => {
		vi.clearAllMocks();

		mockEnv = {
			ACCOUNT_ID: "test-account",
			AI_GATEWAY_TOKEN: "test-token",
		} as IEnv;

		mockUser = {
			id: 1,
			email: "test@example.com",
		} as IUser;

		mockMessages = [
			{
				role: "user",
				content: "Hello, how are you?",
			},
			{
				role: "assistant",
				content: "I'm doing well, thank you!",
			},
		];
	});

	describe("successful token counting", () => {
		it("should count tokens for a supported provider", async () => {
			const { getModelConfigByModel } = await import("~/lib/models");
			const { AIProviderFactory } = await import("~/lib/providers/factory");

			const mockModelConfig = createMockModelConfig(
				"bedrock",
				"claude-3-sonnet",
			);
			const mockProvider = createMockProvider();

			vi.mocked(getModelConfigByModel).mockResolvedValue(mockModelConfig);
			vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);

			const result = await handleCountTokens(
				{ env: mockEnv, user: mockUser },
				{
					model: "claude-3-sonnet",
					messages: mockMessages,
					system_prompt: "You are a helpful assistant.",
				},
			);

			expect(result).toEqual({
				status: "success",
				inputTokens: 42,
				model: "claude-3-sonnet",
			});

			expect(mockProvider.countTokens).toHaveBeenCalledWith(
				{
					model: "claude-3-sonnet",
					messages: mockMessages,
					system_prompt: "You are a helpful assistant.",
					env: mockEnv,
					user: mockUser,
				},
				mockUser.id,
			);
		});

		it("should work without a user", async () => {
			const { getModelConfigByModel } = await import("~/lib/models");
			const { AIProviderFactory } = await import("~/lib/providers/factory");

			const mockModelConfig = createMockModelConfig(
				"bedrock",
				"claude-3-sonnet",
			);
			const mockProvider = createMockProvider(true, 25);

			vi.mocked(getModelConfigByModel).mockResolvedValue(mockModelConfig);
			vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);

			const result = await handleCountTokens(
				{ env: mockEnv },
				{
					model: "claude-3-sonnet",
					messages: mockMessages,
				},
			);

			expect(result).toEqual({
				status: "success",
				inputTokens: 25,
				model: "claude-3-sonnet",
			});

			expect(mockProvider.countTokens).toHaveBeenCalledWith(
				{
					model: "claude-3-sonnet",
					messages: mockMessages,
					system_prompt: undefined,
					env: mockEnv,
					user: undefined,
				},
				undefined,
			);
		});

		it("should work without system prompt", async () => {
			const { getModelConfigByModel } = await import("~/lib/models");
			const { AIProviderFactory } = await import("~/lib/providers/factory");

			const mockModelConfig = createMockModelConfig(
				"bedrock",
				"claude-3-sonnet",
			);
			const mockProvider = createMockProvider(true, 30);

			vi.mocked(getModelConfigByModel).mockResolvedValue(mockModelConfig);
			vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);

			const result = await handleCountTokens(
				{ env: mockEnv, user: mockUser },
				{
					model: "claude-3-sonnet",
					messages: mockMessages,
				},
			);

			expect(result).toEqual({
				status: "success",
				inputTokens: 30,
				model: "claude-3-sonnet",
			});
		});
	});

	describe("error handling", () => {
		it("should return error for unknown model", async () => {
			const { getModelConfigByModel } = await import("~/lib/models");

			vi.mocked(getModelConfigByModel).mockResolvedValue(null);

			const result = await handleCountTokens(
				{ env: mockEnv, user: mockUser },
				{
					model: "unknown-model",
					messages: mockMessages,
				},
			);

			expect(result).toEqual({
				status: "error",
				message: "Model unknown-model not found",
				inputTokens: 0,
				model: "unknown-model",
			});
		});

		it("should return error for unknown provider", async () => {
			const { getModelConfigByModel } = await import("~/lib/models");
			const { AIProviderFactory } = await import("~/lib/providers/factory");

			const mockModelConfig = createMockModelConfig(
				"unknown-provider",
				"some-model",
			);

			vi.mocked(getModelConfigByModel).mockResolvedValue(mockModelConfig);
			vi.mocked(AIProviderFactory.getProvider).mockReturnValue(null);

			const result = await handleCountTokens(
				{ env: mockEnv, user: mockUser },
				{
					model: "some-model",
					messages: mockMessages,
				},
			);

			expect(result).toEqual({
				status: "error",
				message: "Provider unknown-provider not found",
				inputTokens: 0,
				model: "some-model",
			});
		});

		it("should return error for model without token counting support", async () => {
			const { getModelConfigByModel } = await import("~/lib/models");

			const mockModelConfig = createMockModelConfig("openai", "gpt-4", false); // supportsTokenCounting = false

			vi.mocked(getModelConfigByModel).mockResolvedValue(mockModelConfig);

			const result = await handleCountTokens(
				{ env: mockEnv, user: mockUser },
				{
					model: "gpt-4",
					messages: mockMessages,
				},
			);

			expect(result).toEqual({
				status: "error",
				message: "Token counting is not supported for the model gpt-4",
				inputTokens: 0,
				model: "gpt-4",
			});
		});

		it("should return error for provider without token counting support", async () => {
			const { getModelConfigByModel } = await import("~/lib/models");
			const { AIProviderFactory } = await import("~/lib/providers/factory");

			const mockModelConfig = createMockModelConfig("openai", "gpt-4");
			const mockProvider = createMockProvider(false); // No countTokens method

			vi.mocked(getModelConfigByModel).mockResolvedValue(mockModelConfig);
			vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);

			const result = await handleCountTokens(
				{ env: mockEnv, user: mockUser },
				{
					model: "gpt-4",
					messages: mockMessages,
				},
			);

			expect(result).toEqual({
				status: "error",
				message: "Token counting not supported for provider openai",
				inputTokens: 0,
				model: "gpt-4",
			});
		});

		it("should throw AssistantError when provider fails", async () => {
			const { getModelConfigByModel } = await import("~/lib/models");
			const { AIProviderFactory } = await import("~/lib/providers/factory");
			const { AssistantError } = await import("~/utils/errors");

			const mockModelConfig = createMockModelConfig(
				"bedrock",
				"claude-3-sonnet",
			);
			const mockProvider = {
				...createMockProvider(),
				countTokens: vi.fn().mockRejectedValue(new Error("API Error")),
			};

			vi.mocked(getModelConfigByModel).mockResolvedValue(mockModelConfig);
			vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);

			await expect(
				handleCountTokens(
					{ env: mockEnv, user: mockUser },
					{
						model: "claude-3-sonnet",
						messages: mockMessages,
					},
				),
			).rejects.toThrow(AssistantError);

			await expect(
				handleCountTokens(
					{ env: mockEnv, user: mockUser },
					{
						model: "claude-3-sonnet",
						messages: mockMessages,
					},
				),
			).rejects.toThrow("Failed to count tokens");
		});
	});

	describe("edge cases", () => {
		it("should handle empty messages array", async () => {
			const { getModelConfigByModel } = await import("~/lib/models");
			const { AIProviderFactory } = await import("~/lib/providers/factory");

			const mockModelConfig = createMockModelConfig(
				"bedrock",
				"claude-3-sonnet",
			);
			const mockProvider = createMockProvider(true, 0);

			vi.mocked(getModelConfigByModel).mockResolvedValue(mockModelConfig);
			vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);

			const result = await handleCountTokens(
				{ env: mockEnv, user: mockUser },
				{
					model: "claude-3-sonnet",
					messages: [],
				},
			);

			expect(result).toEqual({
				status: "success",
				inputTokens: 0,
				model: "claude-3-sonnet",
			});
		});

		it("should handle complex message content", async () => {
			const { getModelConfigByModel } = await import("~/lib/models");
			const { AIProviderFactory } = await import("~/lib/providers/factory");

			const mockModelConfig = createMockModelConfig(
				"bedrock",
				"claude-3-sonnet",
			);
			const mockProvider = createMockProvider(true, 75);

			const complexMessages: Message[] = [
				{
					role: "user",
					content: [
						{ type: "text", text: "What's in this image?" },
						{
							type: "image_url",
							image_url: { url: "https://example.com/image.jpg" },
						},
					],
				},
			];

			vi.mocked(getModelConfigByModel).mockResolvedValue(mockModelConfig);
			vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);

			const result = await handleCountTokens(
				{ env: mockEnv, user: mockUser },
				{
					model: "claude-3-sonnet",
					messages: complexMessages,
				},
			);

			expect(result).toEqual({
				status: "success",
				inputTokens: 75,
				model: "claude-3-sonnet",
			});

			expect(mockProvider.countTokens).toHaveBeenCalledWith(
				expect.objectContaining({
					messages: complexMessages,
				}),
				mockUser.id,
			);
		});
	});

	describe("Anthropic provider", () => {
		it("should count tokens for Anthropic models", async () => {
			const { getModelConfigByModel } = await import("~/lib/models");
			const { AIProviderFactory } = await import("~/lib/providers/factory");

			const mockModelConfig = createMockModelConfig(
				"anthropic",
				"claude-sonnet-4-0",
			);
			const mockProvider = createMockProvider(true, 28);

			vi.mocked(getModelConfigByModel).mockResolvedValue(mockModelConfig);
			vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);

			const result = await handleCountTokens(
				{ env: mockEnv, user: mockUser },
				{
					model: "claude-4-sonnet",
					messages: [{ role: "user", content: "Count these tokens please" }],
					system_prompt: "You are a helpful assistant",
				},
			);

			expect(result).toEqual({
				status: "success",
				inputTokens: 28,
				model: "claude-4-sonnet",
			});

			expect(mockProvider.countTokens).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "claude-sonnet-4-0",
					messages: [{ role: "user", content: "Count these tokens please" }],
					system_prompt: "You are a helpful assistant",
				}),
				mockUser.id,
			);
		});

		it("should handle Anthropic models without system prompt", async () => {
			const { getModelConfigByModel } = await import("~/lib/models");
			const { AIProviderFactory } = await import("~/lib/providers/factory");

			const mockModelConfig = createMockModelConfig(
				"anthropic",
				"claude-3-5-haiku-latest",
			);
			const mockProvider = createMockProvider(true, 15);

			vi.mocked(getModelConfigByModel).mockResolvedValue(mockModelConfig);
			vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);

			const result = await handleCountTokens(
				{ env: mockEnv, user: mockUser },
				{
					model: "claude-3.5-haiku",
					messages: [{ role: "user", content: "Hello Claude" }],
				},
			);

			expect(result).toEqual({
				status: "success",
				inputTokens: 15,
				model: "claude-3.5-haiku",
			});

			expect(mockProvider.countTokens).toHaveBeenCalledWith(
				expect.objectContaining({
					model: "claude-3-5-haiku-latest",
					messages: [{ role: "user", content: "Hello Claude" }],
					system_prompt: undefined,
				}),
				mockUser.id,
			);
		});
	});
});
