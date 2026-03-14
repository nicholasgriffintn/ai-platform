import { describe, expect, it, vi } from "vitest";
import { getModelConfigByMatchingModel } from "~/lib/providers/models";
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

		it("should add web search tool when search grounding enabled", async () => {
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

			expect(result.tools).toContainEqual({ type: "web_search_preview" });
		});

		it("should handle thinking model parameters in mapParameters", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-4-thinking",
				modalities: { input: ["text"], output: ["text"] },
				reasoningConfig: { enabled: true },
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

		it("should include verbosity controls when provided", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.1",
				modalities: { input: ["text"], output: ["text"] },
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
	});
});
