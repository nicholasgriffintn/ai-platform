import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreChatOptions } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { ChatOrchestrator } from "../ChatOrchestrator";

const {
	mockValidator,
	mockPreparer,
	mockGuardrails,
	mockConversationManager,
	mockGetAIResponse,
	mockCreateMultiModelStream,
	mockCreateStreamWithPostProcessing,
	mockHandleToolCalls,
} = vi.hoisted(() => ({
	mockValidator: {
		validate: vi.fn(),
	},
	mockPreparer: {
		prepare: vi.fn(),
	},
	mockGuardrails: {
		validateOutput: vi.fn(),
	},
	mockConversationManager: {
		checkUsageLimits: vi.fn(),
		add: vi.fn(),
	},
	mockGetAIResponse: vi.fn(),
	mockCreateMultiModelStream: vi.fn(),
	mockCreateStreamWithPostProcessing: vi.fn(),
	mockHandleToolCalls: vi.fn(),
}));

let validationFactory: (() => any) | undefined;
let preparerFactory: ((env: any) => any) | undefined;
let guardrailsFactory: (() => any) | undefined;

vi.mock("~/lib/chat/validation/ValidationPipeline", () => ({
	ValidationPipeline: class {
		constructor() {
			if (validationFactory) {
				return validationFactory();
			}
			return mockValidator;
		}
	},
}));

vi.mock("~/lib/chat/preparation/RequestPreparer", () => ({
	RequestPreparer: class {
		constructor(env: any) {
			if (preparerFactory) {
				return preparerFactory(env);
			}
			return mockPreparer;
		}
	},
}));

vi.mock("~/lib/chat/responses", () => ({
	getAIResponse: mockGetAIResponse,
}));

vi.mock("~/lib/chat/streaming", () => ({
	createStreamWithPostProcessing: mockCreateStreamWithPostProcessing,
}));

vi.mock("~/lib/chat/multiModalStreaming", () => ({
	createMultiModelStream: mockCreateMultiModelStream,
}));

vi.mock("~/lib/chat/tools", () => ({
	handleToolCalls: mockHandleToolCalls,
}));

vi.mock("~/lib/providers/capabilities/guardrails", () => ({
	Guardrails: class {
		constructor() {
			if (guardrailsFactory) {
				return guardrailsFactory();
			}
			return mockGuardrails;
		}
	},
}));

vi.mock("~/utils/id", () => ({
	generateId: () => "test-id",
}));

vi.mock("~/utils/logger", () => ({
	getLogger: () => ({
		warn: vi.fn(),
		error: vi.fn(),
	}),
}));

describe("ChatOrchestrator", () => {
	let orchestrator: ChatOrchestrator;
	let mockOptions: CoreChatOptions;
	let mockEnv: any;

	beforeEach(() => {
		vi.clearAllMocks();

		validationFactory = () => mockValidator;
		preparerFactory = () => mockPreparer;
		guardrailsFactory = () => mockGuardrails;

		mockEnv = { AI: { aiGatewayLogId: "test-log-id" } };
		orchestrator = new ChatOrchestrator(mockEnv);

		mockOptions = {
			completion_id: "test-completion-id",
			model: "test-model",
			messages: [{ role: "user", content: "Hello" }],
			user: { id: "test-user" },
			context: {
				requestId: "request-123",
				requireUser: vi.fn(),
			},
			env: mockEnv,
			app_url: "https://test.com",
		} as any;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("constructor", () => {
		it("should initialize validator and preparer", () => {
			expect(orchestrator).toBeDefined();
		});
	});

	describe("process", () => {
		describe("validation handling", () => {
			it("should return validation error when validation fails", async () => {
				mockValidator.validate.mockResolvedValue({
					validation: {
						isValid: false,
						error: "Invalid input",
						validationType: "input",
						violations: ["test-violation"],
						rawViolations: ["raw-violation"],
					},
					context: {
						modelConfig: { matchingModel: "test-model" },
					},
				});

				const result = await orchestrator.process(mockOptions);

				expect(result).toEqual({
					selectedModel: "test-model",
					validation: "input",
					error: "Invalid input",
					violations: ["test-violation"],
					rawViolations: ["raw-violation"],
				});
			});

			it("should handle missing model config in validation", async () => {
				mockValidator.validate.mockResolvedValue({
					validation: {
						isValid: false,
						error: "Invalid input",
					},
					context: {},
				});

				const result = await orchestrator.process(mockOptions);

				expect(result.selectedModel).toBe("unknown");
			});
		});

		describe("successful processing", () => {
			beforeEach(() => {
				mockValidator.validate.mockResolvedValue({
					validation: { isValid: true },
					context: { modelConfig: { matchingModel: "test-model" } },
				});

				mockPreparer.prepare.mockResolvedValue({
					modelConfigs: [{ model: "test-model" }],
					primaryModel: "test-model",
					primaryProvider: "test-provider",
					conversationManager: mockConversationManager,
					messages: [{ role: "user", content: "Hello" }],
					systemPrompt: "Test system prompt",
					messageWithContext: "Hello with context",
					userSettings: {},
					currentMode: "chat",
				});

				mockConversationManager.checkUsageLimits.mockResolvedValue(undefined);
			});

			it("should process single model non-streaming request successfully", async () => {
				const mockResponse = {
					response: "Test response",
					usage: { total_tokens: 100 },
				};

				mockGetAIResponse.mockResolvedValue(mockResponse);
				mockGuardrails.validateOutput.mockResolvedValue({ isValid: true });
				mockConversationManager.add.mockResolvedValue(undefined);

				const result = await orchestrator.process(mockOptions);

				expect(mockValidator.validate).toHaveBeenCalledWith(mockOptions);
				expect(mockConversationManager.checkUsageLimits).toHaveBeenCalledWith("test-model");
				expect(mockGuardrails.validateOutput).toHaveBeenCalled();
				expect(mockConversationManager.add).toHaveBeenCalled();
				expect(result).toEqual({
					response: mockResponse,
					toolResponses: [],
					selectedModel: "test-model",
					completion_id: "test-completion-id",
				});
			});

			it("should store empty tool calls as null", async () => {
				const mockResponse = {
					response: "Test response",
					tool_calls: [],
					usage: { total_tokens: 100 },
				};

				mockGetAIResponse.mockResolvedValue(mockResponse);
				mockGuardrails.validateOutput.mockResolvedValue({ isValid: true });
				mockConversationManager.add.mockResolvedValue(undefined);

				await orchestrator.process(mockOptions);

				expect(mockConversationManager.add).toHaveBeenCalledWith(
					"test-completion-id",
					expect.objectContaining({
						tool_calls: null,
					}),
				);
			});

			it("should stream progress and final text for agent modes", async () => {
				mockPreparer.prepare.mockResolvedValue({
					modelConfigs: [{ model: "test-model" }],
					primaryModel: "test-model",
					primaryProvider: "test-provider",
					conversationManager: mockConversationManager,
					messages: [{ role: "user", content: "Hello" }],
					systemPrompt: "Test system prompt",
					messageWithContext: "Hello with context",
					userSettings: {},
					currentMode: "agent",
				});
				mockGetAIResponse.mockResolvedValue({
					response: "Agent final answer",
					usage: { total_tokens: 25 },
				});
				mockConversationManager.add.mockResolvedValue(undefined);

				const result = await orchestrator.process({
					...mockOptions,
					stream: true,
				});

				expect(result).toEqual(
					expect.objectContaining({
						selectedModel: "test-model",
						completion_id: "test-completion-id",
						stream: expect.any(ReadableStream),
					}),
				);
				if (!("stream" in result)) {
					throw new Error("Expected streamed agent result");
				}

				const reader = result.stream.getReader();
				const decoder = new TextDecoder();
				let body = "";
				while (true) {
					const { value, done } = await reader.read();
					if (done) {
						break;
					}
					body += decoder.decode(value, { stream: true });
				}
				body += decoder.decode();

				expect(body).toContain('"type":"state"');
				expect(body).toContain('"state":"agent_event"');
				expect(body).toContain('"type":"message_delta"');
				expect(body).toContain("Agent final answer");
				expect(body).toContain("[DONE]");
			});

			it("should handle multi-model streaming request", async () => {
				const multiModelConfig = [{ model: "model-1" }, { model: "model-2" }];

				mockPreparer.prepare.mockResolvedValue({
					modelConfigs: multiModelConfig,
					primaryModel: "model-1",
					primaryProvider: "provider-1",
					conversationManager: mockConversationManager,
					messages: [{ role: "user", content: "Hello" }],
					systemPrompt: "Test system prompt",
					messageWithContext: "Hello with context",
					userSettings: {},
					currentMode: "chat",
				});

				const mockStream = new ReadableStream();
				mockCreateMultiModelStream.mockReturnValue(mockStream);

				const result = await orchestrator.process({
					...mockOptions,
					stream: true,
				});

				expect(mockConversationManager.checkUsageLimits.mock.calls.map(([model]) => model)).toEqual(
					["model-1", "model-2"],
				);
				expect(mockCreateMultiModelStream).toHaveBeenCalled();
				expect(result).toEqual({
					stream: mockStream,
					selectedModel: "model-1",
					selectedModels: ["model-1", "model-2"],
					completion_id: "test-completion-id",
				});
			});

			it("should handle single model streaming request", async () => {
				const mockStream = new ReadableStream();
				const transformedStream = new ReadableStream();

				mockGetAIResponse.mockResolvedValue(mockStream);
				mockCreateStreamWithPostProcessing.mockResolvedValue(transformedStream);

				const result = await orchestrator.process({
					...mockOptions,
					stream: true,
				});

				expect(mockCreateStreamWithPostProcessing).toHaveBeenCalledWith(
					mockStream,
					expect.objectContaining({
						context: mockOptions.context,
					}),
					mockConversationManager,
				);
				expect(result).toEqual({
					stream: transformedStream,
					selectedModel: "test-model",
					completion_id: "test-completion-id",
				});
			});

			it("should give recipe streaming chats enough steps to use context tools and save setup", async () => {
				const mockStream = new ReadableStream();
				const transformedStream = new ReadableStream();

				mockGetAIResponse.mockResolvedValue(mockStream);
				mockCreateStreamWithPostProcessing.mockResolvedValue(transformedStream);

				await orchestrator.process({
					...mockOptions,
					stream: true,
					enabled_tools: ["get_weather", "get_recipe", "configure_recipe"],
					options: {
						recipe: {
							id: "bad-weather-alerts",
							installationId: "installation-1",
							channel: "web",
						},
					},
				});

				expect(mockCreateStreamWithPostProcessing).toHaveBeenCalledWith(
					mockStream,
					expect.objectContaining({
						max_steps: 4,
						requestOptions: {
							recipe: {
								id: "bad-weather-alerts",
								installationId: "installation-1",
								channel: "web",
							},
						},
					}),
					mockConversationManager,
				);
			});

			it("should preserve explicit max steps for recipe streaming chats", async () => {
				const mockStream = new ReadableStream();
				const transformedStream = new ReadableStream();

				mockGetAIResponse.mockResolvedValue(mockStream);
				mockCreateStreamWithPostProcessing.mockResolvedValue(transformedStream);

				await orchestrator.process({
					...mockOptions,
					stream: true,
					max_steps: 2,
					options: {
						recipe: {
							id: "bad-weather-alerts",
							installationId: "installation-1",
							channel: "web",
						},
					},
				});

				expect(mockCreateStreamWithPostProcessing).toHaveBeenCalledWith(
					mockStream,
					expect.objectContaining({
						max_steps: 2,
					}),
					mockConversationManager,
				);
			});

			it("should handle response with tool calls", async () => {
				const mockResponse = {
					response: "Test response",
					tool_calls: [{ id: "tool-1", function: { name: "test_tool" } }],
					usage: { total_tokens: 100 },
				};

				const mockToolResults = [{ role: "tool", content: "tool result", tool_call_id: "tool-1" }];

				mockGetAIResponse.mockResolvedValue(mockResponse);
				mockGuardrails.validateOutput.mockResolvedValue({ isValid: true });
				mockHandleToolCalls.mockResolvedValue(mockToolResults);
				mockConversationManager.add.mockResolvedValue(undefined);

				const result = await orchestrator.process(mockOptions);

				expect(mockHandleToolCalls).toHaveBeenCalledWith(
					"test-completion-id",
					mockResponse,
					mockConversationManager,
					expect.objectContaining({
						context: mockOptions.context,
					}),
				);
				if ("toolResponses" in result) {
					expect(result.toolResponses).toEqual(mockToolResults);
				}
			});

			it("should continue non-streaming tool calls to a final answer when max steps allow it", async () => {
				const toolCallResponse = {
					response: "",
					tool_calls: [
						{
							id: "tool-1",
							type: "function",
							function: { name: "test_tool", arguments: "{}" },
						},
					],
					usage: { total_tokens: 50 },
				};
				const finalResponse = {
					response: "Final answer using the tool result",
					usage: { prompt_tokens: 60, completion_tokens: 40, total_tokens: 100 },
				};
				const mockToolResults = [
					{
						role: "tool",
						name: "test_tool",
						content: "tool result",
						status: "success",
						tool_call_id: "tool-1",
					},
				];

				mockGetAIResponse
					.mockResolvedValueOnce(toolCallResponse)
					.mockResolvedValueOnce(finalResponse);
				mockGuardrails.validateOutput.mockResolvedValue({ isValid: true });
				mockHandleToolCalls.mockResolvedValue(mockToolResults);
				mockConversationManager.add.mockResolvedValue(undefined);

				const result = await orchestrator.process({
					...mockOptions,
					max_steps: 2,
				});

				expect(mockGetAIResponse).toHaveBeenCalledTimes(2);
				expect(mockGetAIResponse).toHaveBeenNthCalledWith(
					2,
					expect.objectContaining({
						messages: expect.arrayContaining([
							expect.objectContaining({
								role: "assistant",
								tool_calls: toolCallResponse.tool_calls,
							}),
							expect.objectContaining({
								role: "tool",
								name: "test_tool",
								tool_call_id: "tool-1",
							}),
						]),
						stream: false,
					}),
				);
				expect(mockConversationManager.add).toHaveBeenNthCalledWith(
					1,
					"test-completion-id",
					expect.objectContaining({
						role: "assistant",
						tool_calls: toolCallResponse.tool_calls,
					}),
				);
				expect(mockConversationManager.add.mock.invocationCallOrder[0]).toBeLessThan(
					mockHandleToolCalls.mock.invocationCallOrder[0],
				);
				expect(result).toEqual({
					response: {
						...finalResponse,
						usage: {
							prompt_tokens: 60,
							completion_tokens: 40,
							total_tokens: 150,
						},
						steps: [
							expect.objectContaining({
								stepNumber: 1,
								stepType: "tool-call",
								toolCallCount: 1,
								toolResultCount: 1,
								usage: { total_tokens: 50 },
							}),
							expect.objectContaining({
								stepNumber: 2,
								stepType: "final",
								toolCallCount: 0,
								toolResultCount: 0,
								usage: { prompt_tokens: 60, completion_tokens: 40, total_tokens: 100 },
							}),
						],
						totalUsage: {
							prompt_tokens: 60,
							completion_tokens: 40,
							total_tokens: 150,
						},
					},
					toolResponses: mockToolResults,
					selectedModel: "test-model",
					completion_id: "test-completion-id",
				});
			});

			it("should preserve delegation context when handling tool calls", async () => {
				const mockResponse = {
					response: "Test response",
					tool_calls: [{ id: "tool-1", function: { name: "delegate_to_team_member" } }],
					usage: { total_tokens: 100 },
				};

				const mockToolResults = [
					{
						role: "tool",
						content: "delegation result",
						tool_call_id: "tool-1",
					},
				];

				const optionsWithDelegation = {
					...mockOptions,
					current_agent_id: "agent-123",
					delegation_stack: ["agent-456"],
					max_delegation_depth: 3,
				};

				mockGetAIResponse.mockResolvedValue(mockResponse);
				mockGuardrails.validateOutput.mockResolvedValue({ isValid: true });
				mockHandleToolCalls.mockResolvedValue(mockToolResults);
				mockConversationManager.add.mockResolvedValue(undefined);

				await orchestrator.process(optionsWithDelegation);

				expect(mockHandleToolCalls).toHaveBeenCalledWith(
					"test-completion-id",
					mockResponse,
					mockConversationManager,
					expect.objectContaining({
						context: mockOptions.context,
						request: expect.objectContaining({
							current_agent_id: "agent-123",
							delegation_stack: ["agent-456"],
							max_delegation_depth: 3,
						}),
					}),
				);
			});

			it("should preserve delegation context in multi-model streaming", async () => {
				const multiModelConfig = [{ model: "model-1" }, { model: "model-2" }];

				mockPreparer.prepare.mockResolvedValue({
					modelConfigs: multiModelConfig,
					primaryModel: "model-1",
					primaryProvider: "provider-1",
					conversationManager: mockConversationManager,
					messages: [{ role: "user", content: "Hello" }],
					systemPrompt: "Test system prompt",
					messageWithContext: "Hello with context",
					userSettings: {},
					currentMode: "chat",
				});

				const mockStream = new ReadableStream();
				mockCreateMultiModelStream.mockReturnValue(mockStream);

				const optionsWithDelegation = {
					...mockOptions,
					stream: true,
					current_agent_id: "agent-789",
					delegation_stack: ["agent-101"],
					max_delegation_depth: 5,
				};

				await orchestrator.process(optionsWithDelegation);

				expect(mockCreateMultiModelStream).toHaveBeenCalledWith(
					expect.objectContaining({
						current_agent_id: "agent-789",
						delegation_stack: ["agent-101"],
						max_delegation_depth: 5,
					}),
					expect.objectContaining({
						context: mockOptions.context,
					}),
					mockConversationManager,
				);
			});

			it("should preserve approved tools in multi-model streaming", async () => {
				const multiModelConfig = [{ model: "model-1" }, { model: "model-2" }];

				mockPreparer.prepare.mockResolvedValue({
					modelConfigs: multiModelConfig,
					primaryModel: "model-1",
					primaryProvider: "provider-1",
					conversationManager: mockConversationManager,
					messages: [{ role: "user", content: "Hello" }],
					systemPrompt: "Test system prompt",
					messageWithContext: "Hello with context",
					userSettings: {},
					currentMode: "chat",
					enabledTools: ["run_code"],
				});

				const mockStream = new ReadableStream();
				mockCreateMultiModelStream.mockReturnValue(mockStream);

				await orchestrator.process({
					...mockOptions,
					stream: true,
					approved_tools: ["run_code"],
				});

				expect(mockCreateMultiModelStream).toHaveBeenCalledWith(
					expect.objectContaining({
						approved_tools: ["run_code"],
					}),
					expect.objectContaining({
						approved_tools: ["run_code"],
						enabled_tools: ["run_code"],
					}),
					mockConversationManager,
				);
			});

			it("should return output validation error", async () => {
				const mockResponse = {
					response: "Inappropriate response",
					usage: { total_tokens: 100 },
				};

				mockGetAIResponse.mockResolvedValue(mockResponse);
				mockGuardrails.validateOutput.mockResolvedValue({
					isValid: false,
					rawResponse: { blockedResponse: "Content blocked" },
					violations: ["inappropriate"],
				});

				const result = await orchestrator.process(mockOptions);

				expect(result).toEqual({
					selectedModel: "test-model",
					validation: "output",
					error: "Content blocked",
					violations: ["inappropriate"],
					rawViolations: { blockedResponse: "Content blocked" },
				});
			});

			it("should throw error when no response generated", async () => {
				mockGetAIResponse.mockResolvedValue({});

				await expect(orchestrator.process(mockOptions)).rejects.toMatchObject({
					message: "No response generated by the model",
					type: ErrorType.PARAMS_ERROR,
					name: "AssistantError",
				});
			});
		});

		describe("error handling", () => {
			beforeEach(() => {
				mockValidator.validate.mockResolvedValue({
					validation: { isValid: true },
					context: { modelConfig: { matchingModel: "test-model" } },
				});
			});

			it("should handle AssistantError and re-throw", async () => {
				const assistantError = new AssistantError("Test error", ErrorType.PARAMS_ERROR);
				mockPreparer.prepare.mockRejectedValue(assistantError);

				await expect(orchestrator.process(mockOptions)).rejects.toThrow(assistantError);
			});

			it("should wrap network errors", async () => {
				const networkError = new Error("Connection failed");
				networkError.name = "TimeoutError";
				mockPreparer.prepare.mockRejectedValue(networkError);

				await expect(orchestrator.process(mockOptions)).rejects.toThrow(
					expect.objectContaining({
						message: "Connection error or timeout while communicating with AI provider",
						type: ErrorType.NETWORK_ERROR,
					}),
				);
			});

			it("should wrap rate limit errors", async () => {
				const rateLimitError = new Error("Rate limited") as any;
				rateLimitError.status = 429;
				mockPreparer.prepare.mockRejectedValue(rateLimitError);

				await expect(orchestrator.process(mockOptions)).rejects.toMatchObject({
					message: "Rate limit exceeded. Please try again later.",
					type: ErrorType.RATE_LIMIT_ERROR,
					name: "AssistantError",
				});
			});

			it("should wrap authentication errors", async () => {
				const authError = new Error("Unauthorized") as any;
				authError.status = 401;
				mockPreparer.prepare.mockRejectedValue(authError);

				const error = await orchestrator.process(mockOptions).catch((e) => e);
				expect(error).toBeInstanceOf(AssistantError);
				expect(error.message).toBe("Authentication error with AI provider");
				expect(error.type).toBe(ErrorType.AUTHENTICATION_ERROR);
				expect(error.statusCode).toBe(401);
			});

			it("should wrap provider errors", async () => {
				const providerError = new Error("Model error") as any;
				providerError.status = 500;
				mockPreparer.prepare.mockRejectedValue(providerError);

				await expect(orchestrator.process(mockOptions)).rejects.toMatchObject({
					message: "Model error",
					type: ErrorType.PROVIDER_ERROR,
					name: "AssistantError",
				});
			});

			it("should wrap unknown errors", async () => {
				const unknownError = new Error("Unknown error");
				mockPreparer.prepare.mockRejectedValue(unknownError);

				await expect(orchestrator.process(mockOptions)).rejects.toThrow(
					expect.objectContaining({
						message: "An unexpected error occurred",
						type: ErrorType.UNKNOWN_ERROR,
					}),
				);
			});
		});

		describe("parameter handling", () => {
			it("should throw error for missing required parameters", async () => {
				mockValidator.validate.mockRejectedValue(new Error("Missing required parameters"));

				await expect(orchestrator.process({} as any)).rejects.toThrow(
					"An unexpected error occurred",
				);
			});
		});
	});
});
