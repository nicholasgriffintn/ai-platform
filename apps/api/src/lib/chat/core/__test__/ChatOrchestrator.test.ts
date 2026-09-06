import { parseChatStreamSseBuffer } from "@ngriffin_uk/polychat-schemas";
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
  mockConsumeProviderStream,
  mockHandleToolCalls,
  mockSessionCompact,
  mockAcquireThread,
  mockAcceptChatRun,
  mockFindAcceptedChatRunCommand,
  mockThreadLease,
} = vi.hoisted(() => ({
  mockThreadLease: {
    conversationId: "test-completion-id",
    kind: "user_message",
    ownerToken: "owner-token",
    expiresAt: "2026-09-05T01:05:00.000Z",
    assertOwned: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
  },
  mockAcquireThread: vi.fn(),
  mockAcceptChatRun: vi.fn(),
  mockFindAcceptedChatRunCommand: vi.fn(),
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
    admitTurn: vi.fn(),
    creditActor: vi.fn(() => null),
    releaseTurnReservation: vi.fn(),
    add: vi.fn(),
    get: vi.fn(async () => []),
    getUsageLimits: vi.fn(async () => null),
  },
  mockGetAIResponse: vi.fn(),
  mockConsumeProviderStream: vi.fn(),
  mockHandleToolCalls: vi.fn(),
  mockSessionCompact: vi.fn(),
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

vi.mock("~/services/conversations/coordinator/client", () => ({
  acquireThread: mockAcquireThread,
  threadLockError: () => new AssistantError("Conversation busy", ErrorType.CONFLICT_ERROR, 409),
}));

vi.mock("~/services/chat-runs/lifecycle", () => ({
  acceptChatRun: mockAcceptChatRun,
  findAcceptedChatRunCommand: mockFindAcceptedChatRunCommand,
}));

vi.mock("~/lib/chat/streaming/responses", () => ({
  getAIResponse: mockGetAIResponse,
}));

vi.mock("~/lib/chat/agent/provider-stream", () => ({
  consumeProviderStream: mockConsumeProviderStream,
}));

vi.mock("~/lib/chat/tools/execution", () => ({
  handleToolCalls: mockHandleToolCalls,
}));

vi.mock("~/lib/session/SessionManager", () => ({
  SessionManager: class {
    compact(input: unknown) {
      return mockSessionCompact(input);
    }
  },
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
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

async function readStream(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    output += decoder.decode(value);
  }

  return output;
}

describe("ChatOrchestrator", () => {
  let orchestrator: ChatOrchestrator;
  let mockOptions: CoreChatOptions;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAcquireThread.mockResolvedValue({ acquired: true, lease: mockThreadLease });
    mockAcceptChatRun.mockResolvedValue(null);
    mockFindAcceptedChatRunCommand.mockResolvedValue(null);

    validationFactory = () => mockValidator;
    preparerFactory = () => mockPreparer;
    guardrailsFactory = () => mockGuardrails;

    mockEnv = { AI: { aiGatewayLogId: "test-log-id" } };
    orchestrator = new ChatOrchestrator(mockEnv);
    mockSessionCompact.mockImplementation(async (input: any) => ({
      messages: input.messages,
      compacted: false,
    }));
    mockConsumeProviderStream.mockImplementation(async (_stream: unknown, sink: any) => {
      await sink.writeEvent("content_block_delta", { content: "Hello" });

      return { content: "Hello", toolCalls: [], parts: [], error: null };
    });

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

        mockPreparer.prepare.mockImplementation(async (options: CoreChatOptions) => ({
          modelConfigs: [{ model: "test-model", provider: "test-provider" }],
          primaryModel: "test-model",
          primaryProvider: "test-provider",
          conversationManager: mockConversationManager,
          messages: [{ role: "user", content: "Hello" }],
          systemPrompt: "Test system prompt",
          messageWithContext: "Hello with context",
          userSettings: {},
          currentMode: "chat",
          requestOptions: options.options,
        }));
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
        expect(mockConversationManager.admitTurn).toHaveBeenCalledWith(
          expect.objectContaining({ messages: expect.any(Array) }),
        );
        expect(mockGuardrails.validateOutput).toHaveBeenCalledWith(
          expect.objectContaining({
            prompt: "Hello with context",
            text: expect.stringContaining("[Response]\nTest response"),
          }),
          undefined,
          "test-completion-id",
        );
        expect(mockConversationManager.add).toHaveBeenCalled();
        expect(result).toEqual({
          response: expect.objectContaining({
            response: "Test response",
            usage: expect.objectContaining({ total_tokens: 100 }),
            totalUsage: expect.objectContaining({ total_tokens: 100 }),
          }),
          toolResponses: [],
          selectedModel: "test-model",
          completion_id: "test-completion-id",
        });
      });

      it("preserves an explicit provider service tier through orchestration", async () => {
        mockGetAIResponse.mockResolvedValue(new ReadableStream());

        const result = await orchestrator.process({
          ...mockOptions,
          service_tier: "fast",
          stream: true,
        });

        if (!("stream" in result)) {
          throw new Error("Expected streamed result");
        }

        await readStream(result.stream);

        expect(mockGetAIResponse).toHaveBeenCalledWith(
          expect.objectContaining({ service_tier: "fast" }),
        );
      });

      it("returns the compaction marker for non-streaming automatic compaction", async () => {
        const compactionMessage = {
          id: "snapshot-1-compaction",
          role: "compaction",
          content: "Context automatically compacted",
          parts: [
            {
              type: "compaction",
              status: "completed",
              label: "Context automatically compacted",
            },
          ],
        };
        const mockResponse = {
          response: "Test response",
          usage: { total_tokens: 100 },
        };

        mockSessionCompact.mockResolvedValueOnce({
          messages: [{ role: "assistant", content: "Conversation snapshot" }],
          compacted: true,
          compactionMessage,
        });
        mockGetAIResponse.mockResolvedValue(mockResponse);
        mockGuardrails.validateOutput.mockResolvedValue({ isValid: true });
        mockConversationManager.add.mockResolvedValue(undefined);

        const result = await orchestrator.process(mockOptions);

        expect(mockGetAIResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [{ role: "assistant", content: "Conversation snapshot" }],
          }),
        );
        expect(result).toEqual(
          expect.objectContaining({
            response: expect.objectContaining({
              response: "Test response",
              usage: expect.objectContaining({ total_tokens: 100 }),
            }),
            toolResponses: [],
            selectedModel: "test-model",
            completion_id: "test-completion-id",
            compactionMessage,
          }),
        );
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
        mockGetAIResponse.mockResolvedValue(new ReadableStream());
        mockConsumeProviderStream.mockImplementation(async (_stream: unknown, sink: any) => {
          await sink.writeEvent("content_block_delta", { content: "Agent final answer" });

          return { content: "Agent final answer", toolCalls: [], parts: [], error: null };
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

        mockGetAIResponse.mockResolvedValue(new ReadableStream());

        const result = await orchestrator.process({
          ...mockOptions,
          stream: true,
        });

        if (!("stream" in result)) {
          throw new Error("Expected streamed result");
        }

        await readStream(result.stream);

        expect(mockConversationManager.admitTurn).toHaveBeenCalledOnce();
        expect(mockConsumeProviderStream).toHaveBeenCalled();
        expect(result).toMatchObject({
          stream: expect.any(ReadableStream),
          selectedModel: "model-1",
          selectedModels: ["model-1", "model-2"],
          completion_id: "test-completion-id",
        });
      });

      it("prepends the compaction marker to multi-model streaming responses", async () => {
        const multiModelConfig = [{ model: "model-1" }, { model: "model-2" }];
        const compactionMessage = {
          id: "snapshot-1-compaction",
          role: "compaction",
          content: "Context automatically compacted",
          parts: [
            {
              type: "compaction",
              status: "completed",
              label: "Context automatically compacted",
            },
          ],
        };

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
        mockSessionCompact.mockResolvedValueOnce({
          messages: [{ role: "assistant", content: "Conversation snapshot" }],
          compacted: true,
          compactionMessage,
        });
        mockGetAIResponse.mockResolvedValue(new ReadableStream());

        const result = await orchestrator.process({
          ...mockOptions,
          stream: true,
        });

        if (!("stream" in result)) {
          throw new Error("Expected streamed result");
        }

        const events = parseChatStreamSseBuffer(await readStream(result.stream), {
          flush: true,
        }).events;

        expect(events[0]).toEqual({
          type: "state",
          state: "compaction",
          message: compactionMessage,
        });
        expect(events).toContainEqual({ type: "content_block_delta", content: "Hello" });
      });

      it("should handle single model streaming request", async () => {
        mockGetAIResponse.mockResolvedValue(new ReadableStream());

        const result = await orchestrator.process({
          ...mockOptions,
          stream: true,
        });

        if (!("stream" in result)) {
          throw new Error("Expected streamed result");
        }

        const body = await readStream(result.stream);

        expect(mockConsumeProviderStream).toHaveBeenCalled();
        expect(body).toContain('"type":"message_delta"');
        expect(result).toMatchObject({
          stream: expect.any(ReadableStream),
          selectedModel: "test-model",
          completion_id: "test-completion-id",
        });
      });

      it("prepends the compaction marker to single model streaming responses", async () => {
        const compactionMessage = {
          id: "snapshot-1-compaction",
          role: "compaction",
          content: "Context automatically compacted",
          parts: [
            {
              type: "compaction",
              status: "completed",
              label: "Context automatically compacted",
            },
          ],
        };
        const providerStream = new ReadableStream();

        mockSessionCompact.mockResolvedValueOnce({
          messages: [{ role: "assistant", content: "Conversation snapshot" }],
          compacted: true,
          compactionMessage,
        });
        mockGetAIResponse.mockResolvedValue(providerStream);

        const result = await orchestrator.process({
          ...mockOptions,
          stream: true,
        });

        if (!("stream" in result)) {
          throw new Error("Expected streamed result");
        }

        const events = parseChatStreamSseBuffer(await readStream(result.stream), {
          flush: true,
        }).events;

        expect(events[0]).toEqual({
          type: "state",
          state: "compaction",
          message: compactionMessage,
        });
        expect(events).toContainEqual({ type: "content_block_delta", content: "Hello" });
      });

      it("should handle response with tool calls", async () => {
        const mockResponse = {
          response: "Test response",
          tool_calls: [{ id: "tool-1", function: { name: "test_tool" } }],
          usage: { total_tokens: 100 },
        };

        const mockToolResults = [{ role: "tool", content: "tool result", tool_call_id: "tool-1" }];

        mockGetAIResponse
          .mockResolvedValueOnce(mockResponse)
          .mockResolvedValueOnce({ response: "Answer using the tool result" });
        mockGuardrails.validateOutput.mockResolvedValue({ isValid: true });
        mockHandleToolCalls.mockResolvedValue(mockToolResults);
        mockConversationManager.add.mockResolvedValue(undefined);

        const result = await orchestrator.process(mockOptions);

        expect(mockHandleToolCalls).toHaveBeenCalledWith(
          "test-completion-id",
          expect.objectContaining({
            tool_calls: [expect.objectContaining({ id: "tool-1" })],
          }),
          mockConversationManager,
          expect.objectContaining({
            context: mockOptions.context,
          }),
          expect.objectContaining({ recoverUnknownToolCalls: true }),
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
        expect(result).toMatchObject({
          response: {
            response: finalResponse.response,
            usage: {
              input_tokens: 60,
              output_tokens: 40,
              total_tokens: 150,
              prompt_tokens: 60,
              completion_tokens: 40,
            },
            steps: [
              expect.objectContaining({
                stepNumber: 1,
                stepType: "tool-call",
                toolCallCount: 1,
                toolResultCount: 1,
                usage: {
                  input_tokens: 0,
                  output_tokens: 0,
                  total_tokens: 50,
                  prompt_tokens: 0,
                  completion_tokens: 0,
                },
              }),
              expect.objectContaining({
                stepNumber: 2,
                stepType: "final",
                toolCallCount: 0,
                toolResultCount: 0,
                usage: {
                  input_tokens: 60,
                  output_tokens: 40,
                  total_tokens: 100,
                  prompt_tokens: 60,
                  completion_tokens: 40,
                },
              }),
            ],
            totalUsage: {
              input_tokens: 60,
              output_tokens: 40,
              total_tokens: 150,
              prompt_tokens: 60,
              completion_tokens: 40,
            },
          },
          toolResponses: mockToolResults,
          selectedModel: "test-model",
          completion_id: "test-completion-id",
        });
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

        mockGetAIResponse.mockResolvedValue(new ReadableStream());

        const result = await orchestrator.process({
          ...mockOptions,
          stream: true,
          approved_tools: ["run_code"],
        });

        if (!("stream" in result)) {
          throw new Error("Expected streamed result");
        }

        await readStream(result.stream);

        expect(mockGetAIResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            approved_tools: ["run_code"],
            enabled_tools: ["run_code"],
          }),
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
          error: "Response did not pass safety checks",
          violations: ["inappropriate"],
        });
        expect(mockConversationManager.add).toHaveBeenCalledWith(
          "test-completion-id",
          expect.objectContaining({ content: "Response blocked by safety checks." }),
        );
        expect(mockConversationManager.add).not.toHaveBeenCalledWith(
          "test-completion-id",
          expect.objectContaining({ content: "Inappropriate response" }),
        );
      });

      it("withholds guarded streams and stops blocked tool calls before execution", async () => {
        mockPreparer.prepare.mockResolvedValue({
          modelConfigs: [{ model: "test-model" }],
          primaryModel: "test-model",
          primaryProvider: "test-provider",
          conversationManager: mockConversationManager,
          messages: [{ role: "user", content: "Hello" }],
          systemPrompt: "Test system prompt",
          messageWithContext: "Hello with context",
          userSettings: { guardrails_enabled: true },
          currentMode: "chat",
        });
        mockGetAIResponse.mockResolvedValue(new ReadableStream());
        mockConsumeProviderStream.mockImplementation(async (_stream: unknown, sink: any) => {
          await sink.writeEvent("content_block_delta", { content: "unsafe streamed output" });

          return {
            content: "unsafe streamed output",
            toolCalls: [
              {
                id: "call-1",
                type: "function",
                function: { name: "dangerous_tool", arguments: "{}" },
              },
            ],
            parts: [],
            error: null,
          };
        });
        mockGuardrails.validateOutput.mockResolvedValue({
          isValid: false,
          violations: ["unsafe_response"],
        });

        const result = await orchestrator.process({ ...mockOptions, stream: true });

        if (!("stream" in result)) {
          throw new Error("Expected streamed result");
        }

        const streamOutput = await readStream(result.stream);

        expect(streamOutput).not.toContain("unsafe streamed output");
        expect(streamOutput).toContain("Response blocked by safety checks.");
        expect(mockHandleToolCalls).not.toHaveBeenCalled();
        expect(mockConversationManager.add).toHaveBeenCalledWith(
          "test-completion-id",
          expect.objectContaining({
            content: "Response blocked by safety checks.",
            tool_calls: null,
          }),
        );
      });

      it("holds the conversation until a streaming response actually finishes", async () => {
        mockGetAIResponse.mockResolvedValue(new ReadableStream());

        const result = (await orchestrator.process({ ...mockOptions, stream: true })) as {
          stream: ReadableStream;
        };

        expect(mockThreadLease.release).not.toHaveBeenCalled();

        const reader = result.stream.getReader();

        while (!(await reader.read()).done) {
          // drain
        }

        expect(mockThreadLease.release).toHaveBeenCalledTimes(1);
      });

      it("keeps holding the conversation when the client stops reading mid-turn", async () => {
        let startTurn: (stream: ReadableStream) => void = () => {};

        mockGetAIResponse.mockReturnValue(
          new Promise<ReadableStream>((resolve) => {
            startTurn = resolve;
          }),
        );

        const result = (await orchestrator.process({ ...mockOptions, stream: true })) as {
          stream: ReadableStream;
        };

        await result.stream.cancel("client went away");

        expect(mockThreadLease.release).not.toHaveBeenCalled();

        startTurn(new ReadableStream());
        await vi.waitFor(() => expect(mockThreadLease.release).toHaveBeenCalledTimes(1));
      });

      it("refuses a turn while another operation holds the conversation", async () => {
        mockAcquireThread.mockResolvedValueOnce({
          acquired: false,
          currentOperation: "user_message",
          reason: "busy",
        });

        await expect(orchestrator.process(mockOptions)).rejects.toMatchObject({
          type: ErrorType.CONFLICT_ERROR,
        });

        expect(mockPreparer.prepare).not.toHaveBeenCalled();
        expect(mockThreadLease.release).not.toHaveBeenCalled();
      });

      it("releases the conversation once the turn finishes", async () => {
        mockGetAIResponse.mockResolvedValue({ response: "Test response" });
        mockGuardrails.validateOutput.mockResolvedValue({ isValid: true });

        await orchestrator.process(mockOptions);

        expect(mockAcquireThread).toHaveBeenCalledWith(
          expect.objectContaining({ conversationId: "test-completion-id", kind: "user_message" }),
        );
        expect(mockPreparer.prepare).toHaveBeenCalledWith(
          mockOptions,
          expect.any(Object),
          mockThreadLease,
          undefined,
        );
        expect(mockThreadLease.release).toHaveBeenCalledTimes(1);
      });

      it("acknowledges a duplicate command without preparing or executing another turn", async () => {
        const run = {
          protocolVersion: 1,
          id: "run-1",
          conversationId: "test-completion-id",
          projectId: null,
          projectTaskId: null,
          initiatorUserId: 7,
          status: "running",
          attempt: 1,
          createdAt: "2026-09-05T12:00:00.000Z",
          updatedAt: "2026-09-05T12:00:00.000Z",
          startedAt: "2026-09-05T12:00:00.000Z",
          completedAt: null,
          terminalReason: null,
          lastMessageId: null,
        } as const;

        mockFindAcceptedChatRunCommand.mockResolvedValueOnce({
          run,
          receipt: {
            protocolVersion: 1,
            commandId: "command-1",
            run,
            kind: "turn",
            acceptedAt: "2026-09-05T12:00:00.000Z",
            duplicate: true,
          },
        });

        const result = await orchestrator.process({
          ...mockOptions,
          command_id: "command-1",
        });

        expect(result).toMatchObject({
          duplicateRun: true,
          runReceipt: { commandId: "command-1", run: { id: "run-1" } },
        });
        expect(mockPreparer.prepare).not.toHaveBeenCalled();
        expect(mockGetAIResponse).not.toHaveBeenCalled();
        expect(mockAcquireThread).not.toHaveBeenCalled();
        expect(mockThreadLease.release).not.toHaveBeenCalled();
      });

      it("rechecks command acceptance when a concurrent original wins the lease", async () => {
        const run = {
          protocolVersion: 1,
          id: "run-race",
          conversationId: "test-completion-id",
          projectId: null,
          projectTaskId: null,
          initiatorUserId: 7,
          status: "running",
          attempt: 1,
          createdAt: "2026-09-05T12:00:00.000Z",
          updatedAt: "2026-09-05T12:00:00.000Z",
          startedAt: "2026-09-05T12:00:00.000Z",
          completedAt: null,
          terminalReason: null,
          lastMessageId: null,
        } as const;
        const duplicate = {
          run,
          receipt: {
            protocolVersion: 1,
            commandId: "command-race",
            run,
            kind: "turn",
            acceptedAt: "2026-09-05T12:00:00.000Z",
            duplicate: true,
          },
        };

        mockFindAcceptedChatRunCommand.mockResolvedValueOnce(null).mockResolvedValueOnce(duplicate);
        mockAcquireThread.mockResolvedValueOnce({
          acquired: false,
          currentOperation: "user_message",
          reason: "busy",
        });

        const result = await orchestrator.process({
          ...mockOptions,
          command_id: "command-race",
        });

        expect(result).toMatchObject({
          duplicateRun: true,
          runReceipt: { run: { id: "run-race" } },
        });
        expect(mockPreparer.prepare).not.toHaveBeenCalled();
      });

      it("should throw error when no response generated", async () => {
        mockGetAIResponse.mockResolvedValue({});

        await expect(orchestrator.process(mockOptions)).rejects.toMatchObject({
          message: "No response generated by the model",
          type: ErrorType.PROVIDER_ERROR,
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

      it("should wrap errors thrown while executing the prepared request", async () => {
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
        mockGetAIResponse.mockRejectedValue(new Error("Execution failed"));

        await expect(orchestrator.process(mockOptions)).rejects.toMatchObject({
          message: "An unexpected error occurred",
          type: ErrorType.UNKNOWN_ERROR,
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
