import { beforeEach, describe, expect, it, vi } from "vitest";

import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import { fetchAIResponse } from "~/lib/providers/lib/fetch";
import { AssistantError, ErrorType } from "~/utils/errors";
import { HuggingFaceProvider } from "../huggingface";

vi.mock("~/lib/providers/models", () => ({
	getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/lib/providers/lib/fetch", () => ({
	fetchAIResponse: vi.fn(),
}));

vi.mock("~/lib/monitoring", () => ({
	trackProviderMetrics: vi.fn(async ({ operation }) => operation()),
}));

const modelConfig = {
	matchingModel: "test/hf-model",
	provider: "huggingface",
	modalities: {
		input: ["text"],
		output: ["text"],
	},
	supportsToolCalls: false,
	supportsTemperature: true,
	maxTokens: 4096,
	inputSchema: {
		fields: [
			{ name: "return_full_text", type: "boolean", default: false },
			{ name: "decoder_input_details", type: "boolean" },
		],
	},
};

const env = {
	AI_GATEWAY_TOKEN: "gateway-token",
	HUGGINGFACE_TOKEN: "hf-token",
};

describe("HuggingFaceProvider", () => {
	beforeEach(() => {
		vi.mocked(getModelConfigByMatchingModel).mockReset();
		vi.mocked(getModelConfigByMatchingModel).mockResolvedValue(modelConfig as any);
		vi.mocked(fetchAIResponse).mockReset();
	});

	describe("mapParameters", () => {
		it("merges schema-backed parameters and explicit extra_body into the chat payload", async () => {
			const provider = new HuggingFaceProvider();

			const result = await provider.mapParameters({
				model: "test/hf-model",
				messages: [{ role: "user", content: "Hello" }],
				env,
				body: {
					extra_body: {
						safety_model: "Meta-Llama/Llama-Guard-7b",
					},
				},
				options: {
					huggingface: {
						extra_body: {
							top_k: 40,
						},
					},
				},
				decoder_input_details: "true",
			} as any);

			expect(result).toMatchObject({
				model: "test/hf-model",
				messages: [{ role: "user", content: "Hello" }],
				max_tokens: 4096,
				return_full_text: false,
				decoder_input_details: true,
				safety_model: "Meta-Llama/Llama-Guard-7b",
				top_k: 40,
			});
		});

		it("rejects extra_body values that would override routing fields", async () => {
			const provider = new HuggingFaceProvider();

			await expect(
				provider.mapParameters({
					model: "test/hf-model",
					messages: [{ role: "user", content: "Hello" }],
					env,
					body: {
						extra_body: {
							model: "other/model",
						},
					},
				} as any),
			).rejects.toThrow('Hugging Face extra_body cannot override "model".');
		});
	});

	describe("getResponse", () => {
		it("returns an async retry placeholder when Hugging Face is still loading a non-streaming model", async () => {
			vi.mocked(fetchAIResponse).mockRejectedValue(
				new AssistantError("Provider unavailable", ErrorType.PROVIDER_ERROR, 503, {
					responseJson: {
						error: "Model test/hf-model is currently loading",
						estimated_time: 7.2,
					},
				}),
			);

			const provider = new HuggingFaceProvider();
			const result = await provider.getResponse({
				model: "test/hf-model",
				messages: [{ role: "user", content: "Hello" }],
				env,
				stream: false,
			} as any);

			expect(result.status).toBe("in_progress");
			expect(result.response[0].text).toContain("Hugging Face is loading this model");
			expect(result.data.asyncInvocation).toMatchObject({
				provider: "huggingface",
				type: "huggingface.chat-completion.retry",
				pollIntervalMs: 7200,
				context: {
					model: "test/hf-model",
					endpoint: "test/hf-model/v1/chat/completions",
					body: {
						stream: false,
					},
				},
			});
			expect(fetchAIResponse).toHaveBeenCalledWith(
				false,
				"huggingface",
				"test/hf-model/v1/chat/completions",
				expect.objectContaining({
					Authorization: "Bearer hf-token",
					"cf-aig-authorization": "gateway-token",
				}),
				expect.objectContaining({
					model: "test/hf-model",
					messages: [{ role: "user", content: "Hello" }],
				}),
				env,
				expect.objectContaining({
					maxAttempts: 3,
					retryDelay: 1000,
					backoff: "exponential",
				}),
			);
		});
	});

	describe("getAsyncInvocationStatus", () => {
		it("replays the stored Hugging Face request and formats a completed response", async () => {
			vi.mocked(fetchAIResponse).mockResolvedValue({
				choices: [{ message: { content: "Ready now" } }],
			});

			const provider = new HuggingFaceProvider();
			const result = await provider.getAsyncInvocationStatus(
				{
					provider: "huggingface",
					id: "retry-1",
					context: {
						model: "test/hf-model",
						endpoint: "test/hf-model/v1/chat/completions",
						body: {
							model: "test/hf-model",
							messages: [{ role: "user", content: "Hello" }],
							stream: false,
						},
					},
				} as any,
				{
					model: "test/hf-model",
					messages: [],
					env,
				} as any,
			);

			expect(result.status).toBe("completed");
			expect(result.result.response).toBe("Ready now");
			expect(fetchAIResponse).toHaveBeenCalledWith(
				false,
				"huggingface",
				"test/hf-model/v1/chat/completions",
				expect.objectContaining({
					Authorization: "Bearer hf-token",
				}),
				expect.objectContaining({
					model: "test/hf-model",
					stream: false,
				}),
				env,
				expect.objectContaining({
					maxAttempts: 3,
					retryDelay: 1000,
				}),
			);
		});
	});
});
