import { beforeEach, describe, expect, it, vi } from "vitest";
import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import type { ChatCompletionParameters, IEnv } from "~/types";
import { createCommonParameters, getToolsForProvider } from "~/utils/parameters";
import { WorkersProvider } from "../workers";

vi.mock("../base", () => ({
	BaseProvider: class MockBaseProvider {
		name = "mock";
		supportsStreaming = true;
		validateAiGatewayToken() {
			return true;
		}
		validateParams(params: any) {
			if (!params.model && !params.version) {
				throw new Error("Missing model or version");
			}
		}
		getEndpoint() {
			return "test-endpoint";
		}
	},
}));

vi.mock("~/lib/providers/models", () => ({
	getModelConfigByMatchingModel: vi.fn(),
}));

vi.mock("~/utils/parameters", () => ({
	createCommonParameters: vi.fn(),
	getToolsForProvider: vi.fn().mockReturnValue({}),
	shouldEnableStreaming: vi.fn().mockReturnValue(false),
}));

global.atob = vi.fn();

describe("WorkersProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("validateParams", () => {
		it("should validate params correctly", async () => {
			const provider = new WorkersProvider();

			const validParams = {
				model: "worker-model",
				messages: [],
				env: {},
			};

			// @ts-ignore - validateParams is protected
			expect(() => provider.validateParams(validParams as any)).not.toThrow();

			const invalidParams = {
				messages: [],
				env: {},
			};

			// @ts-ignore - validateParams is protected
			expect(() => provider.validateParams(invalidParams as any)).toThrow();
		});
	});

	describe("mapParameters", () => {
		it("passes function tools using the Workers AI binding contract", async () => {
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "GLM 5.2",
				matchingModel: "@cf/zai-org/glm-5.2",
				provider: "workers-ai",
				modalities: { input: ["text"], output: ["text"] },
				supportsToolCalls: true,
			});
			vi.mocked(createCommonParameters).mockReturnValue({
				messages: [{ role: "user", content: "Use NASA" }],
			});
			vi.mocked(getToolsForProvider).mockReturnValue({
				tools: [
					{
						type: "function",
						function: {
							name: "use_recipe_connector",
							description: "Use a connected provider",
							parameters: { type: "object", properties: {} },
						},
					},
				],
			});

			const env: IEnv = Object.assign(Object.create(null), {});
			const params: ChatCompletionParameters = {
				model: "@cf/zai-org/glm-5.2",
				messages: [{ role: "user", content: "Use NASA" }],
				env,
			};
			const result = await new WorkersProvider().mapParameters(params);

			expect(result).toMatchObject({
				tools: [
					{
						type: "function",
						function: { name: "use_recipe_connector" },
					},
				],
			});
			expect(result).not.toHaveProperty("toolConfig");
		});

		it("preserves exact tool choice and parallel-call policy", async () => {
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "GLM 4.7 Flash",
				matchingModel: "@cf/zai-org/glm-4.7-flash",
				provider: "workers-ai",
				modalities: { input: ["text"], output: ["text"] },
				supportsToolCalls: true,
			});
			vi.mocked(createCommonParameters).mockReturnValue({
				messages: [{ role: "developer", content: "Continue the approved action" }],
			});
			vi.mocked(getToolsForProvider).mockReturnValue({
				tools: [
					{
						type: "function",
						function: {
							name: "use_recipe_connector",
							description: "Use a connected provider",
							parameters: { type: "object", properties: {} },
						},
					},
				],
				tool_choice: {
					type: "function",
					function: { name: "use_recipe_connector" },
				},
				parallel_tool_calls: false,
			});

			const result = await new WorkersProvider().mapParameters({
				model: "@cf/zai-org/glm-4.7-flash",
				messages: [{ role: "developer", content: "Continue the approved action" }],
				env: Object.assign(Object.create(null), {}),
			} as ChatCompletionParameters);

			expect(result).toMatchObject({
				tool_choice: {
					type: "function",
					function: { name: "use_recipe_connector" },
				},
				parallel_tool_calls: false,
			});
		});

		it("should keep text-only requests on the chat payload for multimodal text models", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "MiniMax M2.7",
				modalities: { input: ["text", "image"], output: ["text"] },
				supportsToolCalls: true,
			});

			vi.mocked(createCommonParameters).mockReturnValue({
				model: "minimax/m2.7",
				messages: [{ role: "user", content: "Hello" }],
			});

			const provider = new WorkersProvider();
			const params = {
				model: "minimax/m2.7",
				messages: [{ role: "user", content: "Hello" }],
				env: {},
			};

			const result = await provider.mapParameters(params as any);

			expect(result).toMatchObject({
				model: "minimax/m2.7",
				messages: [{ role: "user", content: "Hello" }],
			});
			expect(result).not.toHaveProperty("prompt");
			expect(result).not.toHaveProperty("image");
		});

		it("should map MeloTTS requests to prompt/lang payload", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "MyShell MeloTTS",
				modalities: { input: ["text"], output: ["audio"] },
			});

			const provider = new WorkersProvider();
			const params = {
				model: "@cf/myshell-ai/melotts",
				lang: "es",
				messages: [
					{
						role: "user",
						content: [{ type: "text", text: "Hola mundo" }],
					},
				],
				env: {},
			};

			const result = await provider.mapParameters(params as any);

			expect(result).toEqual({
				prompt: "Hola mundo",
				lang: "es",
			});
			expect(createCommonParameters).not.toHaveBeenCalled();
		});

		it("should handle image-to-text processing in mapParameters", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "worker-vision",
				modalities: { input: ["image"], output: ["text"] },
			});

			vi.mocked(createCommonParameters).mockReturnValue({});

			(global.atob as any).mockReturnValue("binary-data");

			const provider = new WorkersProvider();

			const params = {
				model: "worker-vision",
				messages: [
					{
						role: "user",
						content: [
							{ type: "text", text: "What's in this image?" },
							{ type: "image_url", image_url: { url: "base64-data" } },
						],
					},
				],
				env: {},
			};

			const result = await provider.mapParameters(params as any);

			expect(result.prompt).toBe("What's in this image?");
			expect(result.image).toEqual([98, 105, 110, 97, 114, 121, 45, 100, 97, 116, 97]);
		});

		it("should combine system and user prompts in mapParameters", async () => {
			// @ts-ignore - getModelConfigByMatchingModel is not typed
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "worker-vision",
				modalities: { input: ["image"], output: ["text"] },
			});

			vi.mocked(createCommonParameters).mockReturnValue({});

			(global.atob as any).mockReturnValue("binary-data");

			const provider = new WorkersProvider();

			const params = {
				model: "worker-vision",
				messages: [
					{ role: "system", content: "You analyze images" },
					{
						role: "user",
						content: [
							{ type: "text", text: "What do you see?" },
							{
								type: "image_url",
								image_url: {
									url: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
								},
							},
						],
					},
				],
				env: {},
			};

			const result = await provider.mapParameters(params as any);

			expect(result.prompt).toBe("You analyze images\n\nWhat do you see?");
		});
	});
});
