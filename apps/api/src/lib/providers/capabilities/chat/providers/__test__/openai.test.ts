import { describe, expect, it, vi } from "vitest";
import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import type { ModelConfigItem } from "~/types";
import {
	createCommonParameters,
	getToolsForProvider,
	shouldEnableStreaming,
} from "~/utils/parameters";
import { OpenAIProvider } from "../openai";

vi.mock("../base", () => ({
	BaseProvider: class MockBaseProvider {
		name = "mock";
		supportsStreaming = true;
		validateAiGatewayToken() {
			return true;
		}
		validateParams() {}
		async getApiKey() {
			return "test-key";
		}
	},
}));

vi.mock("~/lib/providers/models", () => ({
	getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/utils/parameters", () => ({
	createCommonParameters: vi.fn(),
	getToolsForProvider: vi.fn(),
	shouldEnableStreaming: vi.fn(),
	getEffectiveMaxTokens: vi.fn((_requested, modelMaxTokens) => modelMaxTokens || 4096),
	getReasoningEffortSetting: vi.fn(),
}));

describe("OpenAIProvider", () => {
	describe("mapParameters", () => {
		it("should handle text-to-image generation in mapParameters", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "dall-e-3",
				modalities: { input: ["text"], output: ["image"] },
			});

			vi.mocked(createCommonParameters).mockReturnValue({});
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const params = {
				model: "dall-e-3",
				messages: [
					{ role: "system", content: "You create images" },
					{ role: "user", content: "Draw a sunset over mountains" },
				],
				env: { AI_GATEWAY_TOKEN: "test-token" },
			};

			const result = await provider.mapParameters(params as any);

			expect(result.prompt).toBe("Draw a sunset over mountains");
		});

		it("should pass GPT Image schema parameters through to image generations", async () => {
			const modelConfig = {
				name: "gpt-image-2",
				matchingModel: "gpt-image-2",
				provider: "openai",
				modalities: { input: ["text", "image"], output: ["image"] },
				inputSchema: {
					fields: [
						{ name: "prompt", type: "string", required: true },
						{ name: "size", type: "string" },
						{ name: "quality", type: "string", enum: ["low", "medium", "high", "auto"] },
						{ name: "output_format", type: "string", enum: ["png", "jpeg", "webp"] },
						{ name: "output_compression", type: "integer" },
						{ name: "background", type: "string", enum: ["auto", "opaque"] },
						{ name: "moderation", type: "string", enum: ["auto", "low"] },
						{ name: "n", type: "integer" },
					],
				},
			} satisfies ModelConfigItem;

			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue(modelConfig);
			vi.mocked(createCommonParameters).mockReturnValue({});
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const result = await provider.mapParameters({
				model: "gpt-image-2",
				messages: [{ role: "user", content: "Fallback prompt" }],
				body: {
					input: {
						prompt: "Generate a product photo",
						size: "2048x2048",
						quality: "high",
						output_format: "jpeg",
						output_compression: "60",
						background: "opaque",
						moderation: "low",
						n: "2",
					},
				},
				env: { AI_GATEWAY_TOKEN: "test-token" },
			} as any);

			expect(result).toEqual({
				model: "gpt-image-2",
				prompt: "Generate a product photo",
				size: "2048x2048",
				quality: "high",
				output_format: "jpeg",
				output_compression: 60,
				background: "opaque",
				moderation: "low",
				n: 2,
			});
		});

		it("should handle image-to-image generation in mapParameters", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "dall-e-edit",
				modalities: { input: ["image"], output: ["image"] },
			});

			vi.mocked(createCommonParameters).mockReturnValue({});
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const params = {
				model: "dall-e-edit",
				messages: [
					{ role: "system", content: "You edit images" },
					{
						role: "user",
						content: [
							{ type: "text", text: "Make this image brighter" },
							{
								type: "image_url",
								image_url: { url: "data:image/jpeg;base64,..." },
							},
						],
					},
				],
				env: { AI_GATEWAY_TOKEN: "test-token" },
			};

			const result = await provider.mapParameters(params as any);

			expect(result.prompt).toBe("Make this image brighter");
			expect(result.image).toEqual(["data:image/jpeg;base64,..."]);
		});

		it("should handle search preview model parameters in mapParameters", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-4o-search-preview",
				modalities: { input: ["text"], output: ["text"] },
			});

			vi.mocked(createCommonParameters).mockReturnValue({
				model: "gpt-4o-search-preview",
				temperature: 0.7,
				top_p: 0.9,
				frequency_penalty: 0.1,
				presence_penalty: 0.1,
			});

			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const params = {
				model: "gpt-4o-search-preview",
				messages: [{ role: "user", content: "Hello" }],
				env: { AI_GATEWAY_TOKEN: "test-token" },
			};

			const result = await provider.mapParameters(params as any);

			expect(result.frequency_penalty).toBeUndefined();
			expect(result.presence_penalty).toBeUndefined();
			expect(result.temperature).toBeUndefined();
			expect(result.top_p).toBeUndefined();
		});

		it("should route OpenAI hosted search through Responses API", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-4",
				modalities: { input: ["text"], output: ["text"] },
				supportsToolCalls: true,
				supportsSearchGrounding: true,
			});

			vi.mocked(createCommonParameters).mockReturnValue({
				model: "gpt-4",
				temperature: 0.7,
			});

			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const params = {
				model: "gpt-4",
				messages: [{ role: "user", content: "Search for something" }],
				enabled_tools: ["search_grounding"],
				env: { AI_GATEWAY_TOKEN: "test-token" },
			};

			const result = await provider.mapParameters(params as any);

			expect(result.input).toEqual([
				{ type: "message", role: "user", content: "Search for something" },
			]);
			expect(result.tools).toContainEqual({ type: "web_search" });
			expect(result.max_output_tokens).toBe(4096);
		});

		it("should format assistant history as Responses API input text", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.4",
				matchingModel: "gpt-5.4",
				modalities: { input: ["text"], output: ["text"] },
				supportsToolCalls: true,
				supportsSearchGrounding: true,
			});

			vi.mocked(createCommonParameters).mockReturnValue({ model: "gpt-5.4" });
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const result = await provider.mapParameters({
				model: "gpt-5.4",
				messages: [
					{ role: "user", content: "Hello" },
					{
						role: "assistant",
						content: [{ type: "text", text: "Hi there" }],
					},
					{ role: "user", content: "Search for something" },
				],
				enabled_tools: ["search_grounding"],
				env: { AI_GATEWAY_TOKEN: "test-token" },
			} as any);

			expect(result.input[1]).toEqual({
				type: "message",
				role: "assistant",
				content: [{ type: "input_text", text: "Hi there" }],
			});
		});

		it("should configure hosted tool search with deferred app tools", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.4",
				matchingModel: "gpt-5.4",
				modalities: { input: ["text"], output: ["text"] },
				supportsToolCalls: true,
				supportsToolSearch: true,
			});

			vi.mocked(createCommonParameters).mockReturnValue({ model: "gpt-5.4" });
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const result = await provider.mapParameters({
				model: "gpt-5.4",
				messages: [{ role: "user", content: "Find the right tool" }],
				enabled_tools: ["tool_search"],
				env: { AI_GATEWAY_TOKEN: "test-token" },
			} as any);

			const namespace = result.tools.find((tool: any) => tool.type === "namespace");
			expect(result.tools).toContainEqual({ type: "tool_search" });
			expect(namespace).toMatchObject({
				type: "namespace",
				name: "assistant_tools_1",
			});
			expect(namespace.tools[0]).toMatchObject({
				type: "function",
				defer_loading: true,
			});
		});

		it("should not duplicate system prompts in Responses API instructions", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.4",
				matchingModel: "gpt-5.4",
				modalities: { input: ["text"], output: ["text"] },
				supportsToolCalls: true,
				supportsSearchGrounding: true,
			});

			vi.mocked(createCommonParameters).mockReturnValue({ model: "gpt-5.4" });
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const result = await provider.mapParameters({
				model: "gpt-5.4",
				system_prompt: "Follow the repository rules.",
				messages: [
					{ role: "developer", content: "Follow the repository rules." },
					{ role: "developer", content: "Keep answers concise." },
					{ role: "user", content: "Hello" },
				],
				enabled_tools: ["search_grounding"],
				env: { AI_GATEWAY_TOKEN: "test-token" },
			} as any);

			expect(result.instructions).toBe("Follow the repository rules.\n\nKeep answers concise.");
			expect(result.input).toEqual([{ type: "message", role: "user", content: "Hello" }]);
		});

		it("should preserve assistant tool calls in Responses API input history", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.4",
				matchingModel: "gpt-5.4",
				modalities: { input: ["text"], output: ["text"] },
				supportsToolCalls: true,
				supportsSearchGrounding: true,
			});

			vi.mocked(createCommonParameters).mockReturnValue({ model: "gpt-5.4" });
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const result = await provider.mapParameters({
				model: "gpt-5.4",
				messages: [
					{ role: "user", content: "Look this up" },
					{
						role: "assistant",
						content: "",
						tool_calls: [
							{
								id: "call_lookup",
								type: "function",
								function: {
									name: "lookup",
									arguments: '{"query":"status"}',
								},
							},
						],
					},
					{
						role: "tool",
						tool_call_id: "call_lookup",
						content: "status: green",
					},
					{ role: "user", content: "Continue" },
				],
				enabled_tools: ["search_grounding"],
				env: { AI_GATEWAY_TOKEN: "test-token" },
			} as any);

			expect(result.input).toEqual([
				{ type: "message", role: "user", content: "Look this up" },
				{
					type: "function_call",
					call_id: "call_lookup",
					name: "lookup",
					arguments: '{"query":"status"}',
				},
				{
					type: "function_call_output",
					call_id: "call_lookup",
					output: "status: green",
				},
				{ type: "message", role: "user", content: "Continue" },
			]);
		});

		it("should add OpenAI image generation as a Responses API tool", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.5",
				matchingModel: "gpt-5.5",
				modalities: { input: ["text"], output: ["text"] },
				supportsToolCalls: true,
				supportsImageGenerationTool: true,
				maxTokens: 128000,
			});

			vi.mocked(createCommonParameters).mockReturnValue({ model: "gpt-5.5" });
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const result = await provider.mapParameters({
				model: "gpt-5.5",
				messages: [{ role: "user", content: "Generate an image" }],
				enabled_tools: ["image_generation"],
				options: {
					openai: {
						image_generation: {
							size: "1536x1024",
							quality: "high",
						},
					},
				},
				env: { AI_GATEWAY_TOKEN: "test-token" },
			} as any);

			expect(result.tools).toContainEqual({
				type: "image_generation",
				size: "1536x1024",
				quality: "high",
			});
		});

		it("should handle thinking model parameters in mapParameters", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-4-thinking",
				modalities: { input: ["text"], output: ["text"] },
				reasoningConfig: { supportedEffortLevels: ["none", "thinking", "low", "medium", "high"] },
			});

			vi.mocked(createCommonParameters).mockReturnValue({
				model: "gpt-4-thinking",
				temperature: 0.7,
			});

			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const params = {
				model: "gpt-4-thinking",
				messages: [{ role: "user", content: "Think about this problem" }],
				env: { AI_GATEWAY_TOKEN: "test-token" },
				reasoning_effort: "high",
			};

			const result = await provider.mapParameters(params as any);

			expect(result.reasoning_effort).toBe("high");
			expect(result.reasoning).toBeUndefined();
		});

		it("should omit simulated thinking from provider reasoning parameters", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-4-thinking",
				modalities: { input: ["text"], output: ["text"] },
				reasoningConfig: { supportedEffortLevels: ["none", "thinking", "low", "medium", "high"] },
			});

			vi.mocked(createCommonParameters).mockReturnValue({
				model: "gpt-4-thinking",
				temperature: 0.7,
			});

			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const params = {
				model: "gpt-4-thinking",
				messages: [{ role: "user", content: "Think about this problem" }],
				env: { AI_GATEWAY_TOKEN: "test-token" },
				reasoning_effort: "simulated-thinking",
			};

			const result = await provider.mapParameters(params as any);

			expect(result.reasoning_effort).toBeUndefined();
			expect(result.reasoning).toBeUndefined();
		});

		it("should omit none from provider reasoning parameters", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-4-thinking",
				modalities: { input: ["text"], output: ["text"] },
				reasoningConfig: { supportedEffortLevels: ["none", "thinking", "low", "medium", "high"] },
			});

			vi.mocked(createCommonParameters).mockReturnValue({
				model: "gpt-4-thinking",
				temperature: 0.7,
			});

			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const params = {
				model: "gpt-4-thinking",
				messages: [{ role: "user", content: "No extra reasoning" }],
				env: { AI_GATEWAY_TOKEN: "test-token" },
				reasoning_effort: "none",
			};

			const result = await provider.mapParameters(params as any);

			expect(result.reasoning_effort).toBeUndefined();
			expect(result.reasoning).toBeUndefined();
		});

		it("should include verbosity controls when provided", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.1",
				modalities: { input: ["text"], output: ["text"] },
				verbosityConfig: {
					supportedVerbosityLevels: ["low", "medium", "high"],
					defaultVerbosity: "medium",
				},
			});

			vi.mocked(createCommonParameters).mockReturnValue({
				model: "gpt-5.1",
				temperature: 0.7,
			});

			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const params = {
				model: "gpt-5.1",
				messages: [{ role: "user", content: "Keep it brief" }],
				env: { AI_GATEWAY_TOKEN: "test-token" },
				verbosity: "low",
			};

			const result = await provider.mapParameters(params as any);

			expect(result.verbosity).toBe("low");
			expect(result.text).toBeUndefined();
		});

		it("should omit verbosity controls when the model does not support provider verbosity", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-4o",
				modalities: { input: ["text"], output: ["text"] },
			});

			vi.mocked(createCommonParameters).mockReturnValue({
				model: "gpt-4o",
				temperature: 0.7,
			});

			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const params = {
				model: "gpt-4o",
				messages: [{ role: "user", content: "Keep it brief" }],
				env: { AI_GATEWAY_TOKEN: "test-token" },
				verbosity: "low",
			};

			const result = await provider.mapParameters(params as any);

			expect(result.verbosity).toBeUndefined();
		});

		it("should never send caveman as provider verbosity", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.1",
				modalities: { input: ["text"], output: ["text"] },
				verbosityConfig: {
					supportedVerbosityLevels: ["low", "medium", "high", "caveman"],
					defaultVerbosity: "medium",
				},
			});

			vi.mocked(createCommonParameters).mockReturnValue({
				model: "gpt-5.1",
				temperature: 0.7,
			});

			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const params = {
				model: "gpt-5.1",
				messages: [{ role: "user", content: "Use caveman" }],
				env: { AI_GATEWAY_TOKEN: "test-token" },
				verbosity: "caveman",
			};

			const result = await provider.mapParameters(params as any);

			expect(result.verbosity).toBeUndefined();
		});
	});
});
