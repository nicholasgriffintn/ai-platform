import { describe, expect, it, vi } from "vitest";
import type { ModelConfigItem } from "@assistant/schemas";
import type { StorageService } from "~/lib/storage";
import { getModelConfigByMatchingModel } from "~/lib/providers/models";
import type { ChatCompletionParameters, IEnv, IUser } from "~/types";
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
	createSamplingParameters: vi.fn((params, modelConfig) => ({
		...(modelConfig.supportsTemperature !== false ? { temperature: params.temperature } : {}),
		...(modelConfig.supportsTopP !== false && !params.should_think ? { top_p: params.top_p } : {}),
	})),
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
			const modelConfig: ModelConfigItem = {
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
			};

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

		it("should read private asset URLs through storage for GPT Image edits", async () => {
			const modelConfig: ModelConfigItem = {
				name: "gpt-image-2",
				matchingModel: "gpt-image-2",
				provider: "openai",
				modalities: { input: ["text", "image"], output: ["image"] },
			};
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue(modelConfig);

			const env: IEnv = Object.assign(Object.create(null), {
				AI_GATEWAY_TOKEN: "test-token",
				API_BASE_URL: "http://localhost:8787",
			});
			const user: IUser = Object.assign(Object.create(null), {
				id: 42,
				email: "owner@example.com",
			});
			const params: ChatCompletionParameters = {
				model: "gpt-image-2",
				messages: [
					{ role: "system", content: "Edit images" },
					{
						role: "user",
						content: [
							{ type: "text", text: "Make it brighter" },
							{
								type: "image_url",
								image_url: {
									url: "http://localhost:8787/assets/asset-123",
								},
							},
						],
					},
				],
				env,
				user,
			};
			const storageService: StorageService = Object.create(null);
			storageService.downloadFile = vi
				.fn()
				.mockResolvedValue(new Blob(["image"], { type: "image/png" }));

			const provider = new OpenAIProvider();
			const result = await provider.mapParameters(params, storageService, env.API_BASE_URL);

			expect(result).toBeInstanceOf(FormData);
			expect(storageService.downloadFile).toHaveBeenCalledWith(
				"http://localhost:8787/assets/asset-123",
				42,
				"http://localhost:8787",
			);
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

		it("should use Responses API for regular OpenAI text models by default", async () => {
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.5",
				matchingModel: "gpt-5.5",
				provider: "openai",
				modalities: { input: ["text", "image"], output: ["text"] },
				supportsToolCalls: true,
				maxTokens: 128000,
			} as ModelConfigItem);

			vi.mocked(createCommonParameters).mockReturnValue({
				model: "gpt-5.5",
				temperature: 0.7,
			});
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const endpoint = await (provider as any).getEndpoint({
				model: "gpt-5.5",
				messages: [{ role: "user", content: "Hello" }],
				env: { AI_GATEWAY_TOKEN: "test-token" },
			});
			const result = await provider.mapParameters({
				model: "gpt-5.5",
				messages: [{ role: "user", content: "Hello" }],
				env: { AI_GATEWAY_TOKEN: "test-token" },
			} as any);

			expect(endpoint).toBe("responses");
			expect(result).toMatchObject({
				model: "gpt-5.5",
				input: [{ type: "message", role: "user", content: "Hello" }],
				max_output_tokens: 128000,
			});
			expect(result.messages).toBeUndefined();
		});

		it("should allow OpenAI callers to opt out of Responses API", async () => {
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.5",
				matchingModel: "gpt-5.5",
				provider: "openai",
				modalities: { input: ["text"], output: ["text"] },
				supportsToolCalls: true,
			} as ModelConfigItem);

			vi.mocked(createCommonParameters).mockReturnValue({
				model: "gpt-5.5",
				messages: [{ role: "user", content: "Hello" }],
			});
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();
			const endpoint = await (provider as any).getEndpoint({
				model: "gpt-5.5",
				messages: [{ role: "user", content: "Hello" }],
				use_responses: false,
				env: { AI_GATEWAY_TOKEN: "test-token" },
			});
			const result = await provider.mapParameters({
				model: "gpt-5.5",
				messages: [{ role: "user", content: "Hello" }],
				use_responses: false,
				env: { AI_GATEWAY_TOKEN: "test-token" },
			} as any);

			expect(endpoint).toBe("chat/completions");
			expect(result.messages).toEqual([{ role: "user", content: "Hello" }]);
			expect(result.input).toBeUndefined();
		});

		it("should convert Chat Completions function tools and tool_choice for Responses", async () => {
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.5",
				matchingModel: "gpt-5.5",
				provider: "openai",
				modalities: { input: ["text"], output: ["text"] },
				supportsToolCalls: true,
			} as ModelConfigItem);

			vi.mocked(createCommonParameters).mockReturnValue({ model: "gpt-5.5" });
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({
				tools: [
					{
						type: "function",
						function: {
							name: "lookup",
							description: "Look up data",
							parameters: { type: "object", properties: {} },
							strict: true,
						},
					},
				],
			});

			const provider = new OpenAIProvider();
			const result = await provider.mapParameters({
				model: "gpt-5.5",
				messages: [{ role: "user", content: "Use the tool" }],
				tool_choice: { type: "function", function: { name: "lookup" } },
				env: { AI_GATEWAY_TOKEN: "test-token" },
			} as any);

			expect(result.tools).toContainEqual({
				type: "function",
				name: "lookup",
				description: "Look up data",
				parameters: { type: "object", properties: {} },
				strict: true,
			});
			expect(result.tool_choice).toEqual({ type: "function", name: "lookup" });
		});

		it("should auto-reuse stored Responses state from assistant history", async () => {
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.5",
				matchingModel: "gpt-5.5",
				provider: "openai",
				modalities: { input: ["text"], output: ["text"] },
				supportsToolCalls: true,
			} as ModelConfigItem);

			vi.mocked(createCommonParameters).mockReturnValue({ model: "gpt-5.5" });
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();
			const result = await provider.mapParameters({
				model: "gpt-5.5",
				messages: [
					{ role: "user", content: "First turn" },
					{
						role: "assistant",
						content: "First answer",
						data: { openai_response_id: "resp_previous" },
					},
					{ role: "user", content: "Second turn" },
				],
				store: true,
				env: { AI_GATEWAY_TOKEN: "test-token" },
			} as any);

			expect(result.previous_response_id).toBe("resp_previous");
			expect(result.input).toEqual([{ type: "message", role: "user", content: "Second turn" }]);
		});

		it("should enable OpenAI background Responses when storage is enabled", async () => {
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.5",
				matchingModel: "gpt-5.5",
				provider: "openai",
				modalities: { input: ["text"], output: ["text"] },
				supportsToolCalls: true,
			} as ModelConfigItem);

			vi.mocked(createCommonParameters).mockReturnValue({ model: "gpt-5.5" });
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();
			const result = await provider.mapParameters({
				model: "gpt-5.5",
				messages: [{ role: "user", content: "Run this in the background" }],
				store: true,
				background: true,
				env: { AI_GATEWAY_TOKEN: "test-token" },
			} as any);

			expect(result.background).toBe(true);
			expect(result.store).toBe(true);
		});

		it("should reject OpenAI background Responses when storage is disabled", async () => {
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.5",
				matchingModel: "gpt-5.5",
				provider: "openai",
				modalities: { input: ["text"], output: ["text"] },
				supportsToolCalls: true,
			} as ModelConfigItem);

			vi.mocked(createCommonParameters).mockReturnValue({ model: "gpt-5.5" });
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			await expect(
				provider.mapParameters({
					model: "gpt-5.5",
					messages: [{ role: "user", content: "Run this in the background" }],
					store: false,
					background: true,
					env: { AI_GATEWAY_TOKEN: "test-token" },
				} as any),
			).rejects.toThrow("background Responses require store=true");
		});

		it("should expose newer Responses API hosted tool and state options", async () => {
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.5",
				matchingModel: "gpt-5.5",
				provider: "openai",
				modalities: { input: ["text"], output: ["text"] },
				supportsToolCalls: true,
				supportsCodeExecution: true,
				supportsFileSearch: true,
				supportsMcp: true,
				supportsComputerUse: true,
				supportsHostedShell: true,
				reasoningConfig: { supportedEffortLevels: ["none", "low", "medium", "high"] },
			} as ModelConfigItem);

			vi.mocked(createCommonParameters).mockReturnValue({ model: "gpt-5.5" });
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();
			const result = await provider.mapParameters({
				model: "gpt-5.5",
				messages: [{ role: "user", content: "Use hosted tools" }],
				store: false,
				enabled_tools: ["code_interpreter", "file_search", "mcp", "computer_use", "hosted_shell"],
				background: false,
				prompt_cache_key: "conversation:test",
				tool_options: {
					file_search: {
						vector_store_ids: ["vs_123"],
						include_results: true,
					},
					computer_use: {
						display_width: 1024,
						display_height: 768,
						environment: "browser",
						include_output_image_url: true,
					},
					shell: {
						environment: { type: "container_auto" },
					},
					mcp_servers: [
						{
							server_label: "docs",
							server_description: "Documentation search",
							server_url: "https://mcp.example.com",
							allowed_tools: ["search"],
							require_approval: "never",
							defer_loading: true,
						},
					],
				},
				env: { AI_GATEWAY_TOKEN: "test-token" },
			} as any);

			expect(result.tools).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						type: "code_interpreter",
						container: { type: "auto" },
					}),
					expect.objectContaining({ type: "file_search", vector_store_ids: ["vs_123"] }),
					expect.objectContaining({
						type: "mcp",
						server_label: "docs",
						server_description: "Documentation search",
						server_url: "https://mcp.example.com",
						allowed_tools: ["search"],
						require_approval: "never",
						defer_loading: true,
					}),
					expect.objectContaining({
						type: "computer",
						display_width: 1024,
						display_height: 768,
						environment: "browser",
					}),
					expect.objectContaining({
						type: "shell",
						environment: { type: "container_auto" },
					}),
				]),
			);
			expect(result.include).toEqual(
				expect.arrayContaining([
					"reasoning.encrypted_content",
					"code_interpreter_call.outputs",
					"file_search_call.results",
					"computer_call_output.output.image_url",
				]),
			);
			expect(result.prompt_cache_key).toBe("conversation:test");
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

		it("should pass configured hosted tool search namespaces through shared options", async () => {
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-5.4",
				matchingModel: "gpt-5.4",
				provider: "openai",
				modalities: { input: ["text"], output: ["text"] },
				supportsToolCalls: true,
				supportsToolSearch: true,
			} as ModelConfigItem);

			vi.mocked(createCommonParameters).mockReturnValue({ model: "gpt-5.4" });
			vi.mocked(shouldEnableStreaming).mockReturnValue(false);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const result = await provider.mapParameters({
				model: "gpt-5.4",
				messages: [{ role: "user", content: "Find the right remote tool" }],
				enabled_tools: ["tool_search"],
				tool_options: {
					tool_search: {
						execution: "client",
						include_app_tools: false,
						max_tool_search_results: 5,
						namespaces: [
							{
								type: "namespace",
								name: "workspace",
								description: "Workspace tools",
								tools: [
									{
										type: "function",
										name: "search_workspace",
										description: "Search workspace context",
										parameters: { type: "object", properties: {} },
										defer_loading: true,
									},
								],
							},
						],
					},
				},
				env: { AI_GATEWAY_TOKEN: "test-token" },
			} as any);

			expect(result.tools).toContainEqual({
				type: "namespace",
				name: "workspace",
				description: "Workspace tools",
				tools: [
					{
						type: "function",
						name: "search_workspace",
						description: "Search workspace context",
						parameters: { type: "object", properties: {} },
						defer_loading: true,
					},
				],
			});
			expect(result.tools).toContainEqual({
				type: "tool_search",
				execution: "client",
				max_tool_search_results: 5,
			});
			expect(result.tools.find((tool: any) => tool.type === "tool_search")).not.toHaveProperty(
				"include_app_tools",
			);
			expect(result.tools.some((tool: any) => tool.name === "assistant_tools_1")).toBe(false);
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
				tool_options: {
					image_generation: {
						size: "1536x1024",
						quality: "high",
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

		it("should request audio output for OpenAI audio chat models", async () => {
			vi.mocked(getModelConfigByMatchingModel).mockResolvedValue({
				name: "gpt-audio-1.5",
				matchingModel: "gpt-audio-1.5",
				provider: "openai",
				modalities: { input: ["text", "audio"], output: ["text", "audio"] },
				supportsToolCalls: true,
			} as ModelConfigItem);
			vi.mocked(createCommonParameters).mockReturnValue({
				model: "gpt-audio-1.5",
				messages: [{ role: "user", content: "Say hello" }],
				max_completion_tokens: 16384,
			});
			vi.mocked(shouldEnableStreaming).mockReturnValue(true);
			vi.mocked(getToolsForProvider).mockReturnValue({ tools: [] });

			const provider = new OpenAIProvider();

			const result = await provider.mapParameters({
				model: "gpt-audio-1.5",
				messages: [{ role: "user", content: "Say hello" }],
				env: { AI_GATEWAY_TOKEN: "test-token" },
				stream: true,
				audio: {
					voice: "cedar",
					format: "wav",
				},
			} as any);

			expect(result).toMatchObject({
				model: "gpt-audio-1.5",
				modalities: ["text", "audio"],
				audio: {
					voice: "cedar",
					format: "wav",
				},
			});
			expect(result.stream).toBeUndefined();
		});
	});
});
