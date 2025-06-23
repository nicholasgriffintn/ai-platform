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

vi.mock("~/lib/chat/validation/ValidationPipeline", () => ({
  ValidationPipeline: vi.fn(() => mockValidator),
}));

vi.mock("~/lib/chat/preparation/RequestPreparer", () => ({
  RequestPreparer: vi.fn(() => mockPreparer),
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

vi.mock("~/lib/guardrails", () => ({
  Guardrails: {
    getInstance: () => mockGuardrails,
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

    mockEnv = { AI: { aiGatewayLogId: "test-log-id" } };
    orchestrator = new ChatOrchestrator(mockEnv);

    mockOptions = {
      completion_id: "test-completion-id",
      model: "test-model",
      messages: [{ role: "user", content: "Hello" }],
      user: { id: "test-user" },
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
        expect(mockConversationManager.checkUsageLimits).toHaveBeenCalledWith(
          "test-model",
        );
        expect(mockGuardrails.validateOutput).toHaveBeenCalled();
        expect(mockConversationManager.add).toHaveBeenCalled();
        expect(result).toEqual({
          response: mockResponse,
          toolResponses: [],
          selectedModel: "test-model",
          completion_id: "test-completion-id",
        });
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
          expect.any(Object),
          mockConversationManager,
        );
        expect(result).toEqual({
          stream: transformedStream,
          selectedModel: "test-model",
          completion_id: "test-completion-id",
        });
      });

      it("should handle response with tool calls", async () => {
        const mockResponse = {
          response: "Test response",
          tool_calls: [{ id: "tool-1", function: { name: "test_tool" } }],
          usage: { total_tokens: 100 },
        };

        const mockToolResults = [
          { role: "tool", content: "tool result", tool_call_id: "tool-1" },
        ];

        mockGetAIResponse.mockResolvedValue(mockResponse);
        mockGuardrails.validateOutput.mockResolvedValue({ isValid: true });
        mockHandleToolCalls.mockResolvedValue(mockToolResults);
        mockConversationManager.add.mockResolvedValue(undefined);

        const result = await orchestrator.process(mockOptions);

        expect(mockHandleToolCalls).toHaveBeenCalledWith(
          "test-completion-id",
          mockResponse,
          mockConversationManager,
          expect.any(Object),
        );
        if ("toolResponses" in result) {
          expect(result.toolResponses).toEqual(mockToolResults);
        }
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

        await expect(orchestrator.process(mockOptions)).rejects.toThrow(
          new AssistantError(
            "No response generated by the model",
            ErrorType.PARAMS_ERROR,
          ),
        );
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
        const assistantError = new AssistantError(
          "Test error",
          ErrorType.PARAMS_ERROR,
        );
        mockPreparer.prepare.mockRejectedValue(assistantError);

        await expect(orchestrator.process(mockOptions)).rejects.toThrow(
          assistantError,
        );
      });

      it("should wrap network errors", async () => {
        const networkError = new Error("Connection failed");
        networkError.name = "TimeoutError";
        mockPreparer.prepare.mockRejectedValue(networkError);

        await expect(orchestrator.process(mockOptions)).rejects.toThrow(
          expect.objectContaining({
            message:
              "Connection error or timeout while communicating with AI provider",
            type: ErrorType.NETWORK_ERROR,
          }),
        );
      });

      it("should wrap rate limit errors", async () => {
        const rateLimitError = new Error("Rate limited") as any;
        rateLimitError.status = 429;
        mockPreparer.prepare.mockRejectedValue(rateLimitError);

        await expect(orchestrator.process(mockOptions)).rejects.toThrow(
          new AssistantError(
            "Rate limit exceeded. Please try again later.",
            ErrorType.RATE_LIMIT_ERROR,
            rateLimitError,
          ),
        );
      });

      it("should wrap authentication errors", async () => {
        const authError = new Error("Unauthorized") as any;
        authError.status = 401;
        mockPreparer.prepare.mockRejectedValue(authError);

        await expect(orchestrator.process(mockOptions)).rejects.toThrow(
          new AssistantError(
            "Authentication error with AI provider",
            ErrorType.AUTHENTICATION_ERROR,
            authError,
          ),
        );
      });

      it("should wrap provider errors", async () => {
        const providerError = new Error("Model error") as any;
        providerError.status = 500;
        mockPreparer.prepare.mockRejectedValue(providerError);

        await expect(orchestrator.process(mockOptions)).rejects.toThrow(
          new AssistantError(
            "Model error",
            ErrorType.PROVIDER_ERROR,
            providerError,
          ),
        );
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
        mockValidator.validate.mockRejectedValue(
          new Error("Missing required parameters"),
        );

        await expect(orchestrator.process({} as any)).rejects.toThrow(
          "An unexpected error occurred",
        );
      });
    });
  });
});
