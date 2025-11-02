import { beforeEach, describe, expect, it, vi } from "vitest";

import { getModelConfigByMatchingModel } from "~/lib/models";
import { AIProviderFactory } from "~/lib/providers/factory";
import { AssistantError, ErrorType } from "~/utils/errors";
import { formatMessages } from "~/utils/messages";
import { mergeParametersWithDefaults } from "~/utils/parameters";
import { withRetry } from "~/utils/retries";
import { formatAssistantMessage, getAIResponse } from "../responses";

vi.mock("~/lib/models", () => ({
	getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/lib/providers/factory", () => ({
	AIProviderFactory: {
		getProvider: vi.fn(),
	},
}));

vi.mock("~/utils/messages", () => ({
	formatMessages: vi.fn(),
}));

vi.mock("~/utils/parameters", () => ({
	mergeParametersWithDefaults: vi.fn(),
}));

vi.mock("~/utils/retries", () => ({
	withRetry: vi.fn(),
}));

vi.mock("~/utils/id", () => ({
	generateId: vi.fn(() => "test-id-123"),
}));

vi.mock("~/utils/logger", () => ({
	getLogger: vi.fn(() => ({
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	})),
}));

vi.mock("~/utils/errors", () => ({
	AssistantError: class extends Error {
		type: string;
		constructor(message: string, type?: string, _originalError?: any) {
			super(message);
			this.type = type || "UNKNOWN";
			this.name = "AssistantError";
		}
	},
	ErrorType: {
		PARAMS_ERROR: "PARAMS_ERROR",
		PROVIDER_ERROR: "PROVIDER_ERROR",
		RATE_LIMIT_ERROR: "RATE_LIMIT_ERROR",
		AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
	},
}));

describe("responses", () => {
	beforeEach(async () => {
		vi.clearAllMocks();
	});

	describe("formatAssistantMessage", () => {
		it("should format minimal message data with defaults", () => {
			const result = formatAssistantMessage({});

			expect(result).toEqual({
				content: "",
				thinking: "",
				signature: "",
				citations: [],
				tool_calls: [],
				data: null,
				usage: {
					prompt_tokens: 0,
					completion_tokens: 0,
					total_tokens: 0,
				},
				guardrails: { passed: true },
				log_id: null,
				model: "",
				selected_models: [],
				platform: "api",
				timestamp: expect.any(Number),
				id: "test-id-123",
				finish_reason: "stop",
				mode: undefined,
				refusal: null,
				annotations: null,
			});
		});

		it("should format complete message data", () => {
			const input = {
				content: "Hello world",
				thinking: "I need to respond",
				signature: "sig123",
				citations: [{ url: "test.com" }],
				tool_calls: [{ id: "tool1", function: { name: "test" } }],
				data: { key: "value" },
				usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
				guardrails: { passed: false, reason: "blocked" },
				log_id: "log123",
				model: "gpt-4",
				selected_models: ["gpt-4", "claude"],
				platform: "web",
				timestamp: 1234567890,
				id: "custom-id",
				finish_reason: "length",
				mode: "creative",
				refusal: "blocked",
				annotations: [{ note: "x" }],
			};

			// @ts-expect-error - test data
			const result = formatAssistantMessage(input);

			expect(result.content).toEqual([
				{
					type: "thinking",
					thinking: "I need to respond",
					signature: "sig123",
				},
				{
					type: "text",
					text: "Hello world",
				},
			]);
			expect(result.thinking).toBe("I need to respond");
			expect(result.signature).toBe("sig123");
			expect(result.citations).toEqual([{ url: "test.com" }]);
			expect(result.tool_calls).toEqual([
				{ id: "tool1", function: { name: "test" } },
			]);
			expect(result.finish_reason).toBe("length");
			expect(result.refusal).toBe("blocked");
			expect(result.annotations).toEqual([{ note: "x" }]);
		});

		it("should handle thinking without content", () => {
			const result = formatAssistantMessage({
				thinking: "Just thinking",
				signature: "sig123",
			});

			expect(result.content).toEqual([
				{
					type: "thinking",
					thinking: "Just thinking",
					signature: "sig123",
				},
			]);
		});

		it("should determine finish_reason as tool_calls when tool_calls exist", () => {
			const result = formatAssistantMessage({
				tool_calls: [{ id: "tool1" }],
			});

			expect(result.finish_reason).toBe("tool_calls");
		});

		it("should handle invalid tool_calls format", () => {
			const result = formatAssistantMessage({
				tool_calls: "invalid" as any,
			});

			expect(result.tool_calls).toEqual([]);
		});

		it("should handle invalid citations format", () => {
			const result = formatAssistantMessage({
				citations: "invalid" as any,
			});

			expect(result.citations).toEqual([]);
		});

		it("should handle invalid timestamp", () => {
			const result = formatAssistantMessage({
				timestamp: "invalid" as any,
			});

			expect(result.timestamp).toEqual(expect.any(Number));
		});
	});

	describe("getAIResponse", () => {
		const baseParams = {
			app_url: "https://test.com",
			system_prompt: "You are helpful",
			env: {},
			user: { id: "user123" },
			mode: "normal",
			model: "gpt-4",
			messages: [{ role: "user", content: "Hello" }],
			message: "Hello",
			enabled_tools: [],
			tools: [],
			body: {},
		};

		const mockModelConfig = {
			provider: "openai",
			type: ["text"],
			supportsStreaming: true,
		};

		const mockProvider = {
			name: "openai",
			supportsStreaming: true,
			getResponse: vi.fn(),
		};

		beforeEach(() => {
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue(
				// @ts-expect-error - mock implementation
				mockModelConfig,
			);
			// @ts-expect-error - mock implementation
			vi.mocked(AIProviderFactory.getProvider).mockReturnValue(mockProvider);
			vi.mocked(formatMessages).mockReturnValue([
				{ role: "user", content: "Hello" },
			]);
			// @ts-expect-error - mock implementation
			vi.mocked(mergeParametersWithDefaults).mockReturnValue({ ...baseParams });
			vi.mocked(withRetry).mockImplementation((fn) => fn());
			mockProvider.getResponse.mockResolvedValue({
				content: "Hello back",
				usage: { total_tokens: 10 },
			});
		});

		it("should successfully get AI response", async () => {
			// @ts-expect-error - test data
			const result = await getAIResponse(baseParams);

			expect(getModelConfigByMatchingModel).toHaveBeenCalledWith("gpt-4");
			expect(AIProviderFactory.getProvider).toHaveBeenCalledWith("openai");
			expect(formatMessages).toHaveBeenCalledWith(
				"openai",
				[{ role: "user", content: "Hello" }],
				"You are helpful",
				"gpt-4",
			);
			expect(result).toEqual({
				content: "Hello back",
				usage: { total_tokens: 10 },
			});
		});

		it("should throw error when model is missing", async () => {
			await expect(
				// @ts-expect-error - test data
				getAIResponse({ ...baseParams, model: "" }),
			).rejects.toMatchObject({
				message: "Model is required",
				type: ErrorType.PARAMS_ERROR,
				name: "AssistantError",
			});
		});

		it("should throw error when messages is empty", async () => {
			await expect(
				// @ts-expect-error - test data
				getAIResponse({ ...baseParams, messages: [] }),
			).rejects.toThrow(
				new AssistantError(
					"Messages array is required and cannot be empty",
					ErrorType.PARAMS_ERROR,
				),
			);
		});

		it("should throw error when messages is not an array", async () => {
			await expect(
				// @ts-expect-error - test data
				getAIResponse({ ...baseParams, messages: null as any }),
			).rejects.toThrow(
				new AssistantError(
					"Messages array is required and cannot be empty",
					ErrorType.PARAMS_ERROR,
				),
			);
		});

		it("should handle model configuration not found", async () => {
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue(null);

			// @ts-expect-error - test data
			await expect(getAIResponse(baseParams)).rejects.toThrow(
				"Invalid model configuration for gpt-4: Model configuration not found for gpt-4",
			);
		});

		it("should handle model configuration error", async () => {
			vi.mocked(getModelConfigByMatchingModel).mockRejectedValue(
				new Error("Config error"),
			);

			// @ts-expect-error - test data
			await expect(getAIResponse(baseParams)).rejects.toThrow(
				new AssistantError(
					"Invalid model configuration for gpt-4: Config error",
					ErrorType.PARAMS_ERROR,
				),
			);
		});

		it("should handle provider initialization error", async () => {
			vi.mocked(AIProviderFactory.getProvider).mockImplementation(() => {
				throw new Error("Provider error");
			});

			// @ts-expect-error - test data
			await expect(getAIResponse(baseParams)).rejects.toThrow(
				new AssistantError(
					"Failed to initialize provider openai: Provider error",
					ErrorType.PROVIDER_ERROR,
				),
			);
		});

		it("should filter messages by mode", async () => {
			const messagesWithModes = [
				{ role: "user", content: "Normal", mode: "normal" },
				{ role: "user", content: "Creative", mode: "creative" },
				{ role: "user", content: "No mode" },
			];

			await getAIResponse({
				...baseParams,
				// @ts-expect-error - test data
				messages: messagesWithModes,
				mode: "normal",
			});

			expect(formatMessages).toHaveBeenCalledWith(
				"openai",
				[
					{ role: "user", content: "Normal", mode: "normal" },
					{ role: "user", content: "No mode" },
				],
				"You are helpful",
				"gpt-4",
			);
		});

		it("should handle no messages after filtering", async () => {
			const messagesWithModes = [
				{ role: "user", content: "Creative", mode: "creative" },
			];

			await expect(
				getAIResponse({
					...baseParams,
					// @ts-expect-error - test data
					messages: messagesWithModes,
					mode: "normal",
				}),
			).rejects.toThrow(
				new AssistantError(
					"No valid messages after filtering",
					ErrorType.PARAMS_ERROR,
				),
			);
		});

		it("should handle message formatting error", async () => {
			vi.mocked(formatMessages).mockImplementation(() => {
				throw new Error("Format error");
			});

			// @ts-expect-error - test data
			await expect(getAIResponse(baseParams)).rejects.toThrow(
				new AssistantError(
					"Failed to format messages: Format error",
					ErrorType.PARAMS_ERROR,
				),
			);
		});

		it("should enable streaming when conditions are met", async () => {
			// @ts-expect-error - test data
			await getAIResponse({
				...baseParams,
				stream: true,
			});

			expect(mergeParametersWithDefaults).toHaveBeenCalledWith(
				expect.objectContaining({
					stream: true,
				}),
			);
		});

		it("should disable streaming for non-text model types", async () => {
			// @ts-expect-error - mock implementation
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				...mockModelConfig,
				type: ["text-to-image"],
			});

			// @ts-expect-error - test data
			await getAIResponse({
				...baseParams,
				stream: true,
			});

			expect(mergeParametersWithDefaults).toHaveBeenCalledWith(
				expect.objectContaining({
					stream: false,
				}),
			);
		});

		it("should handle parameter merging error", async () => {
			vi.mocked(mergeParametersWithDefaults).mockImplementation(() => {
				throw new Error("Parameter error");
			});

			// @ts-expect-error - test data
			await expect(getAIResponse(baseParams)).rejects.toThrow(
				new AssistantError(
					"Failed to prepare request parameters: Parameter error",
					ErrorType.PARAMS_ERROR,
				),
			);
		});

		it("should handle rate limit errors", async () => {
			mockProvider.getResponse.mockRejectedValue({
				message: "rate limit exceeded",
				status: 429,
			});

			// @ts-expect-error - test data
			await expect(getAIResponse(baseParams)).rejects.toThrow(
				new AssistantError(
					"openai error: rate limit exceeded",
					ErrorType.RATE_LIMIT_ERROR,
				),
			);
		});

		it("should handle authentication errors", async () => {
			mockProvider.getResponse.mockRejectedValue({
				message: "unauthorized",
				status: 401,
			});

			// @ts-expect-error - test data
			await expect(getAIResponse(baseParams)).rejects.toThrow(
				new AssistantError(
					"openai error: unauthorized",
					ErrorType.AUTHENTICATION_ERROR,
				),
			);
		});

		it("should handle server errors", async () => {
			mockProvider.getResponse.mockRejectedValue({
				message: "internal server error",
				status: 500,
			});

			// @ts-expect-error - test data
			await expect(getAIResponse(baseParams)).rejects.toThrow(
				new AssistantError(
					"openai error: internal server error",
					ErrorType.PROVIDER_ERROR,
				),
			);
		});

		it("should handle empty response from provider", async () => {
			mockProvider.getResponse.mockResolvedValue(null);

			// @ts-expect-error - test data
			await expect(getAIResponse(baseParams)).rejects.toThrow(
				new AssistantError(
					"Provider returned empty response",
					ErrorType.PROVIDER_ERROR,
				),
			);
		});

		it("should log metrics on successful response", async () => {
			const responseWithUsage = {
				content: "Hello back",
				usage: { total_tokens: 15 },
			};
			mockProvider.getResponse.mockResolvedValue(responseWithUsage);

			// @ts-expect-error - test data
			await getAIResponse(baseParams);

			expect(responseWithUsage).toEqual({
				content: "Hello back",
				usage: { total_tokens: 15 },
			});
		});
	});
});
