import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

const {
	mockUploadImageFromChat,
	mockUploadAudioFromChat,
	mockStorageService,
	mockBucket,
} = vi.hoisted(() => {
	const mockUploadImageFromChat = vi.fn();
	const mockUploadAudioFromChat = vi.fn();
	const mockStorageService = {
		uploadObject: vi.fn().mockResolvedValue("test-key"),
		getObject: vi.fn(),
	};
	const mockBucket = {
		put: vi.fn().mockResolvedValue(undefined),
		get: vi.fn(),
	};

	return {
		mockUploadImageFromChat,
		mockUploadAudioFromChat,
		mockStorageService,
		mockBucket,
	};
});

vi.mock("../storage", () => ({
	StorageService: class {
		constructor() {
			return mockStorageService;
		}
	},
}));

vi.mock("../upload", () => ({
	uploadImageFromChat: mockUploadImageFromChat,
	uploadAudioFromChat: mockUploadAudioFromChat,
}));

global.fetch = vi.fn();

import { ResponseFormatter } from "../responses";

describe("ResponseFormatter", () => {
	const mockEnv: IEnv = {
		ASSETS_BUCKET: mockBucket as unknown as IEnv["ASSETS_BUCKET"],
		PUBLIC_ASSETS_URL: "https://assets.example.com",
	} as IEnv;

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("formatResponse", () => {
		it("should format OpenAI response", async () => {
			const data = {
				choices: [{ message: { content: "OpenAI response" } }],
			};

			const result = await ResponseFormatter.formatResponse(data, "openai");

			expect(result.response).toBe("OpenAI response");
		});

		it("should format Anthropic response", async () => {
			const data = {
				content: [
					{ type: "text", text: "Anthropic response" },
					{ type: "thinking", thinking: "Internal thought" },
				],
			};

			const result = await ResponseFormatter.formatResponse(data, "anthropic");

			expect(result.response).toBe("Anthropic response");
			expect(result.thinking).toBe("Internal thought");
		});

		it("should format Google AI Studio response", async () => {
			const data = {
				candidates: [
					{
						content: {
							parts: [
								{ text: "Google response" },
								{
									functionCall: {
										name: "test_function",
										args: { param: "value" },
									},
								},
							],
						},
					},
				],
			};

			const result = await ResponseFormatter.formatResponse(
				data,
				"google-ai-studio",
			);

			expect(result.response).toBe("Google response");
			expect(result.tool_calls).toHaveLength(1);
			expect(result.tool_calls[0].name).toBe("test_function");
		});

		it("should use OpenAI formatter for providers that share format", async () => {
			const data = {
				choices: [{ message: { content: "Shared format response" } }],
			};

			const providers = [
				"groq",
				"mistral",
				"perplexity-ai",
				"deepseek",
				"huggingface",
				"github-models",
				"together-ai",
			];

			for (const provider of providers) {
				const result = await ResponseFormatter.formatResponse(data, provider);
				expect(result.response).toBe("Shared format response");
			}
		});

		it("should handle unknown provider with generic formatter", async () => {
			const data = {
				choices: [{ message: { content: "Unknown provider response" } }],
			};

			const result = await ResponseFormatter.formatResponse(
				data,
				"unknown-provider",
			);

			expect(result.response).toBe("Unknown provider response");
		});
	});

	describe("formatOpenAIResponse", () => {
		it("should handle image generation response", async () => {
			const data = {
				data: [
					{ url: "https://example.com/image1.png" },
					{ url: "https://example.com/image2.png" },
				],
			};

			const result = await ResponseFormatter.formatResponse(data, "openai", {
				modalities: { input: ["text"], output: ["image"] },
			});

			expect(result.response).toHaveLength(2);
			expect(result.response[0].type).toBe("image_url");
			expect(result.response[0].image_url.url).toBe(
				"https://example.com/image1.png",
			);
			expect(result.response[1].image_url.url).toBe(
				"https://example.com/image2.png",
			);
		});

		it("should handle image generation without env", async () => {
			const data = {
				data: [{ url: "https://example.com/image.png" }],
			};

			const result = await ResponseFormatter.formatResponse(data, "openai", {
				modalities: { input: ["text"], output: ["image"] },
			});

			expect(result.response).toHaveLength(1);
			expect(result.response[0].image_url.url).toBe(
				"https://example.com/image.png",
			);
		});

		it("uploads base64 image generations and strips raw payloads", async () => {
			const base64Image =
				"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO4cF2kAAAAASUVORK5CYII=";
			const data = {
				created: 123,
				data: [
					{
						b64_json: base64Image,
						revised_prompt: "Refined hamster prompt",
					},
				],
			};

			const result = await ResponseFormatter.formatResponse(data, "openai", {
				modalities: { input: ["text"], output: ["image"] },
				env: mockEnv,
				model: "gpt-image-1.5",
				completion_id: "chat_123",
			});

			const storageCalls =
				mockStorageService.uploadObject.mock.calls.length +
				mockBucket.put.mock.calls.length;
			expect(storageCalls).toBe(1);

			const [key, bytes, options] =
				mockStorageService.uploadObject.mock.calls[0] ||
				mockBucket.put.mock.calls[0];
			expect(key).toContain("generations/chat_123/gpt-image-1.5/");
			expect((options as any).contentType).toBe("image/png");
			expect((bytes as Uint8Array).byteLength).toBeGreaterThan(0);

			expect(result.response).toHaveLength(1);
			expect(result.response[0].image_url.url).toContain(
				mockEnv.PUBLIC_ASSETS_URL,
			);
			expect(result.data.assets).toHaveLength(1);
			expect(result.data.revised_prompt).toBe("Refined hamster prompt");
			expect(JSON.stringify(result).includes(base64Image)).toBe(false);
		});

		it("should handle regular chat response", async () => {
			const data = {
				choices: [
					{
						message: {
							content: "Chat response",
							tool_calls: [{ id: "call_1", function: { name: "test" } }],
						},
					},
				],
			};

			const result = await ResponseFormatter.formatResponse(data, "openai");

			expect(result.response).toBe("Chat response");
			expect(result.tool_calls).toHaveLength(1);
		});

		describe("QwQ preprocessing", () => {
			it("should add <think> tag for QwQ models with </think> but no <think>", async () => {
				const data = {
					choices: [
						{
							message: {
								content: "Some thinking content\n</think>\nActual response",
							},
						},
					],
				};

				const result = await ResponseFormatter.formatResponse(data, "openai", {
					model: "qwen-qwq-32b",
				});

				expect(result.response).toBe(
					"<think>\nSome thinking content\n</think>\nActual response",
				);
			});

			it("should not modify content that already has <think> tag", async () => {
				const data = {
					choices: [
						{
							message: {
								content: "<think>Some thinking</think>\nResponse",
							},
						},
					],
				};

				const result = await ResponseFormatter.formatResponse(data, "openai", {
					model: "qwen-qwq-32b",
				});

				expect(result.response).toBe("<think>Some thinking</think>\nResponse");
			});

			it("should not modify non-QwQ model responses", async () => {
				const data = {
					choices: [
						{
							message: {
								content: "Some content\n</think>",
							},
						},
					],
				};

				const result = await ResponseFormatter.formatResponse(data, "openai", {
					model: "gpt-4",
				});

				expect(result.response).toBe("Some content\n</think>");
			});

			it("should not modify content without </think> tag", async () => {
				const data = {
					choices: [
						{
							message: {
								content: "Regular response content",
							},
						},
					],
				};

				const result = await ResponseFormatter.formatResponse(data, "openai", {
					model: "qwen-qwq-32b",
				});

				expect(result.response).toBe("Regular response content");
			});

			it("should handle empty content gracefully", async () => {
				const data = {
					choices: [
						{
							message: {
								content: "",
							},
						},
					],
				};

				const result = await ResponseFormatter.formatResponse(data, "openai", {
					model: "qwen-qwq-32b",
				});

				expect(result.response).toBe("");
			});

			it("should handle undefined model gracefully", async () => {
				const data = {
					choices: [
						{
							message: {
								content: "Some content\n</think>",
							},
						},
					],
				};

				const result = await ResponseFormatter.formatResponse(data, "openai", {
					model: undefined,
				});

				expect(result.response).toBe("Some content\n</think>");
			});

			it("should detect QwQ models case-insensitively", async () => {
				const data = {
					choices: [
						{
							message: {
								content: "Thinking...\n</think>\nResponse",
							},
						},
					],
				};

				const result = await ResponseFormatter.formatResponse(data, "openai", {
					model: "QWEN-QWQ-32B",
				});

				expect(result.response).toBe(
					"<think>\nThinking...\n</think>\nResponse",
				);
			});

			it("should handle content with whitespace around <think>", async () => {
				const data = {
					choices: [
						{
							message: {
								content: "  \n  <think>Already has think tag</think>  ",
							},
						},
					],
				};

				const result = await ResponseFormatter.formatResponse(data, "openai", {
					model: "qwq-32b",
				});

				expect(result.response).toBe(
					"  \n  <think>Already has think tag</think>  ",
				);
			});

			it("should handle complex content with multiple </think> tags", async () => {
				const data = {
					choices: [
						{
							message: {
								content:
									"First thought\n</think>\nSome text\n</think>\nFinal response",
							},
						},
					],
				};

				const result = await ResponseFormatter.formatResponse(data, "openai", {
					model: "qwq-model",
				});

				expect(result.response).toBe(
					"<think>\nFirst thought\n</think>\nSome text\n</think>\nFinal response",
				);
			});
		});
	});

	describe("formatReplicateResponse", () => {
		it("should format image outputs without persistence", async () => {
			const data = {
				output: ["https://replicate.delivery/example/output-0.png"],
			};

			const result = await ResponseFormatter.formatResponse(data, "replicate", {
				modalities: { input: ["text"], output: ["image"] },
			});

			expect(result.response).toEqual([
				{
					type: "image_url",
					image_url: { url: "https://replicate.delivery/example/output-0.png" },
				},
			]);
			expect(mockStorageService.uploadObject).not.toHaveBeenCalled();
		});

		it("should persist image outputs when storage is configured", async () => {
			const data = {
				output: ["https://replicate.delivery/example/output-0.png"],
			};

			const mockFetch = vi.mocked(fetch);
			mockFetch.mockResolvedValue({
				ok: true,
				arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
			} as unknown as Response);

			const result = await ResponseFormatter.formatResponse(data, "replicate", {
				modalities: { input: ["text"], output: ["image"] },
				env: mockEnv,
				model: "replicate-image",
			});

			expect(mockFetch).toHaveBeenCalledWith(
				"https://replicate.delivery/example/output-0.png",
			);
			const storageCalls =
				mockStorageService.uploadObject.mock.calls.length +
				mockBucket.put.mock.calls.length;
			expect(storageCalls).toBeGreaterThan(0);
			const responseUrl = (result.response as any)[0].image_url.url as string;
			expect(responseUrl.startsWith(mockEnv.PUBLIC_ASSETS_URL || "")).toBe(
				true,
			);
			expect(result.data.assets[0].originalUrl).toBe(
				"https://replicate.delivery/example/output-0.png",
			);
		});

		it("should format audio outputs", async () => {
			const data = {
				output: "https://replicate.delivery/example/output-0.mp3",
			};

			const result = await ResponseFormatter.formatResponse(data, "replicate", {
				modalities: { input: ["text"], output: ["audio"] },
			});

			expect(result.response).toEqual([
				{
					type: "audio_url",
					audio_url: {
						url: "https://replicate.delivery/example/output-0.mp3",
					},
				},
			]);
		});

		it("should format text outputs for transcription", async () => {
			const data = {
				output: { text: "Transcribed speech" },
			};

			const result = await ResponseFormatter.formatResponse(data, "replicate", {
				modalities: { input: ["audio"], output: ["text"] },
			});

			expect(result.response).toBe("Transcribed speech");
		});
	});

	describe("formatAnthropicResponse", () => {
		it("should handle response with no content", async () => {
			const data = {};

			const result = await ResponseFormatter.formatResponse(data, "anthropic");

			expect(result.response).toBe("");
		});

		it("should extract text and thinking content", async () => {
			const data = {
				content: [
					{ type: "text", text: "First text" },
					{ type: "text", text: "Second text" },
					{ type: "thinking", thinking: "My thoughts" },
					{ type: "other", data: "ignored" },
				],
			};

			const result = await ResponseFormatter.formatResponse(data, "anthropic");

			expect(result.response).toBe("First text Second text");
			expect(result.thinking).toBe("My thoughts");
		});

		it("should handle signature in thinking content", async () => {
			const data = {
				content: [
					{ type: "text", text: "Response text" },
					{
						type: "thinking",
						thinking: "Thoughts",
						signature: "signature_data",
					},
				],
			};

			const result = await ResponseFormatter.formatResponse(data, "anthropic");

			expect(result.signature).toBe("signature_data");
		});
	});

	describe("formatGoogleStudioResponse", () => {
		it("should handle response with no candidates", async () => {
			const data = {};

			const result = await ResponseFormatter.formatResponse(
				data,
				"google-ai-studio",
			);

			expect(result.response).toBe("");
			expect(result.tool_calls).toEqual([]);
		});

		it("should handle executable code in response", async () => {
			const data = {
				candidates: [
					{
						content: {
							parts: [
								{ text: "Here's the code:" },
								{
									executableCode: {
										language: "python",
										code: "print('hello')",
									},
								},
							],
						},
					},
				],
			};

			const result = await ResponseFormatter.formatResponse(
				data,
				"google-ai-studio",
			);

			expect(result.response).toContain("Here's the code:");
			expect(result.response).toContain(
				'<artifact identifier="executable-code-1"',
			);
			expect(result.response).toContain("print('hello')");
		});

		it("should handle code execution results", async () => {
			const data = {
				candidates: [
					{
						content: {
							parts: [
								{
									codeExecutionResult: {
										outcome: "OK",
										output: "hello\n",
									},
								},
							],
						},
					},
				],
			};

			const result = await ResponseFormatter.formatResponse(
				data,
				"google-ai-studio",
			);

			expect(result.response).toContain("hello");
		});
	});

	describe("formatOllamaResponse", () => {
		it("should format Ollama response", async () => {
			const data = {
				message: { content: "Ollama response" },
				other: "field",
			};

			const result = await ResponseFormatter.formatResponse(data, "ollama");

			expect(result.response).toBe("Ollama response");
			expect(result.other).toBe("field");
		});
	});

	describe("formatWorkersResponse", () => {
		it("should handle image generation for workers", async () => {
			const data = {
				image: "base64imagedata",
			};

			const result = await ResponseFormatter.formatResponse(
				data,
				"workers-ai",
				{
					modalities: { input: ["text"], output: ["image"] },
				},
			);

			expect(result.response).toBe("base64imagedata");
		});

		it("should handle text generation for workers", async () => {
			const data = {
				result: "Workers text response",
			};

			const result = await ResponseFormatter.formatResponse(data, "workers");

			expect(result.response).toBe("Workers text response");
		});

		it("should handle audio generation for workers", async () => {
			const data = {
				result: [1, 2, 3, 4, 5],
			};

			const result = await ResponseFormatter.formatResponse(
				data,
				"workers-ai",
				{
					modalities: { input: ["text"], output: ["audio"] },
					env: mockEnv,
					completion_id: "test-completion",
				},
			);

			expect(result.response).toEqual([1, 2, 3, 4, 5]);
		});

		describe("QwQ preprocessing", () => {
			it("should add <think> tag for QwQ models with </think> but no <think> in data.response", async () => {
				const data = {
					response: "Some thinking content\n</think>\nActual response",
				};

				const result = await ResponseFormatter.formatResponse(
					data,
					"workers-ai",
					{
						model: "qwq-32b",
					},
				);

				expect(result.response).toBe(
					"<think>\nSome thinking content\n</think>\nActual response",
				);
			});

			it("should add <think> tag for QwQ models with </think> but no <think> in data.result", async () => {
				const data = {
					result: "Some thinking content\n</think>\nActual response",
				};

				const result = await ResponseFormatter.formatResponse(
					data,
					"workers-ai",
					{
						model: "qwq-32b",
					},
				);

				expect(result.response).toBe(
					"<think>\nSome thinking content\n</think>\nActual response",
				);
			});

			it("should not modify content that already has <think> tag in data.response", async () => {
				const data = {
					response: "<think>Some thinking</think>\nResponse",
				};

				const result = await ResponseFormatter.formatResponse(
					data,
					"workers-ai",
					{
						model: "qwq-32b",
					},
				);

				expect(result.response).toBe("<think>Some thinking</think>\nResponse");
			});

			it("should not modify content that already has <think> tag in data.result", async () => {
				const data = {
					result: "<think>Some thinking</think>\nResponse",
				};

				const result = await ResponseFormatter.formatResponse(
					data,
					"workers-ai",
					{
						model: "qwq-32b",
					},
				);

				expect(result.response).toBe("<think>Some thinking</think>\nResponse");
			});

			it("should not modify non-QwQ model responses", async () => {
				const data = {
					response: "Some content\n</think>",
				};

				const result = await ResponseFormatter.formatResponse(
					data,
					"workers-ai",
					{
						model: "llama-2-7b",
					},
				);

				expect(result.response).toBe("Some content\n</think>");
			});

			it("should handle empty response gracefully", async () => {
				const data = {
					response: "",
				};

				const result = await ResponseFormatter.formatResponse(
					data,
					"workers-ai",
					{
						model: "qwq-32b",
					},
				);

				expect(result.response).toBe("");
			});

			it("should handle empty result gracefully", async () => {
				const data = {
					result: "",
				};

				const result = await ResponseFormatter.formatResponse(
					data,
					"workers-ai",
					{
						model: "qwq-32b",
					},
				);

				expect(result.response).toBe("");
			});

			it("should detect QwQ models case-insensitively", async () => {
				const data = {
					result: "Thinking...\n</think>\nResponse",
				};

				const result = await ResponseFormatter.formatResponse(
					data,
					"workers-ai",
					{
						model: "QWQ-32B",
					},
				);

				expect(result.response).toBe(
					"<think>\nThinking...\n</think>\nResponse",
				);
			});

			it("should handle Workers formatter alias", async () => {
				const data = {
					result: "Thinking...\n</think>\nResponse",
				};

				const result = await ResponseFormatter.formatResponse(data, "workers", {
					model: "qwq-32b",
				});

				expect(result.response).toBe(
					"<think>\nThinking...\n</think>\nResponse",
				);
			});
		});
	});

	describe("formatBedrockResponse", () => {
		it("should handle Bedrock image generation", async () => {
			const data = {
				images: ["base64imagedata"],
			};

			const result = await ResponseFormatter.formatResponse(data, "bedrock", {
				modalities: { input: ["text"], output: ["image"] },
			});

			expect(result.response).toBe("base64imagedata");
		});

		it("should handle Bedrock text generation", async () => {
			const data = {
				output: {
					message: {
						content: [{ text: "Bedrock response" }],
					},
				},
			};

			const result = await ResponseFormatter.formatResponse(data, "bedrock");

			expect(result.response).toBe("Bedrock response");
		});
	});

	describe("formatGenericResponse", () => {
		it("should handle response field", async () => {
			const data = { response: "Generic response" };

			const result = await ResponseFormatter.formatResponse(data, "unknown");

			expect(result.response).toBe("Generic response");
		});

		it("should extract from choices array", async () => {
			const data = {
				choices: [{ message: { content: "Choice content" } }],
			};

			const result = await ResponseFormatter.formatResponse(data, "unknown");

			expect(result.response).toBe("Choice content");
		});

		it("should handle delta content", async () => {
			const data = {
				choices: [{ delta: { content: "Delta content" } }],
			};

			const result = await ResponseFormatter.formatResponse(data, "unknown");

			expect(result.response).toBe("Delta content");
		});

		it("should handle text field in choices", async () => {
			const data = {
				choices: [{ text: "Choice text" }],
			};

			const result = await ResponseFormatter.formatResponse(data, "unknown");

			expect(result.response).toBe("Choice text");
		});

		it("should handle direct content array", async () => {
			const data = {
				content: [
					{ type: "text", text: "Array text" },
					{ type: "thinking", thinking: "Array thinking" },
				],
			};

			const result = await ResponseFormatter.formatResponse(data, "unknown");

			expect(result.response).toBe("Array text");
			expect(result.thinking).toBe("Array thinking");
		});

		it("should handle message content array", async () => {
			const data = {
				message: {
					content: [
						{ type: "text", text: "Message text" },
						{
							type: "thinking",
							thinking: "Message thinking",
							signature: "sig",
						},
					],
				},
			};

			const result = await ResponseFormatter.formatResponse(data, "unknown");

			expect(result.response).toBe("Message text");
			expect(result.thinking).toBe("Message thinking");
			expect(result.signature).toBe("sig");
		});

		it("should return empty response for unrecognized format", async () => {
			const data = { unknown: "field" };

			const result = await ResponseFormatter.formatResponse(data, "unknown");

			expect(result.response).toBe("");
		});
	});

	describe("error handling", () => {
		it("should handle missing ASSETS_BUCKET for image upload", async () => {
			const data = {
				data: [{ url: "https://example.com/image.png" }],
			};

			const envWithoutBucket = { ...mockEnv, ASSETS_BUCKET: undefined };

			await expect(
				ResponseFormatter.formatResponse(data, "openai", {
					modalities: { input: ["text"], output: ["image"] },
					env: envWithoutBucket,
				}),
			).rejects.toThrow("ASSETS_BUCKET is not set");
		});

		it("should handle fetch failure during image upload", async () => {
			const data = {
				data: [{ url: "https://example.com/image.png" }],
			};

			const mockFetch = vi.mocked(fetch);
			mockFetch.mockRejectedValue(new Error("Fetch failed"));

			await expect(
				ResponseFormatter.formatResponse(data, "openai", {
					modalities: { input: ["text"], output: ["image"] },
					env: mockEnv,
				}),
			).rejects.toThrow("Fetch failed");
		});

		it("should handle missing ASSETS_BUCKET for image upload", async () => {
			const data = {
				data: [{ url: "https://example.com/image.png" }],
			};

			const envWithoutBucket = { ...mockEnv, ASSETS_BUCKET: undefined };

			await expect(
				ResponseFormatter.formatResponse(data, "openai", {
					modalities: { input: ["text"], output: ["image"] },
					env: envWithoutBucket,
				}),
			).rejects.toThrow("ASSETS_BUCKET is not set");
		});
	});
});
