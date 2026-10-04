import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleCreateChatCompletions } from "../createChatCompletions";

const { mockConversationManagerGetInstance, mockThreadLease } = vi.hoisted(() => ({
  mockConversationManagerGetInstance: vi.fn(() => ({
    getAllMessages: vi.fn(),
  })),
  mockThreadLease: {
    assertOwned: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
  },
}));

vi.mock("~/modules/chat/application/core", () => ({
  processChatRequest: vi.fn(),
}));

vi.mock("~/modules/chat/application/messages/assistant-format", () => ({
  formatAssistantMessage: vi.fn(),
}));

vi.mock("~/modules/conversations/application/manager", () => ({
  ConversationManager: { getInstance: mockConversationManagerGetInstance },
}));

vi.mock("~/modules/conversations/infrastructure/coordinator/client", () => ({
  withThreadLock: vi.fn(async (_params, run) => run(mockThreadLease)),
}));

vi.mock("~/modules/apps/application/connectors/approved-operation-replay", () => ({
  replayApprovedConnectorOperation: vi.fn(),
}));

const mockEnv = {
  AI: {
    aiGatewayLogId: "test-log-id",
  },
  DB: "test-db",
} as any;

const mockUser = {
  id: "user-123",
  email: "test@example.com",
} as any;

describe("handleCreateChatCompletions", () => {
  let mockProcessChatRequest: any;
  let mockFormatAssistantMessage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { processChatRequest } = await import("~/modules/chat/application/core");
    const { formatAssistantMessage } =
      await import("~/modules/chat/application/messages/assistant-format");

    mockProcessChatRequest = vi.mocked(processChatRequest);
    mockFormatAssistantMessage = vi.mocked(formatAssistantMessage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("parameter validation", () => {
    it("should throw error for missing messages", async () => {
      const request = {} as any;

      await expect(() =>
        handleCreateChatCompletions({
          env: mockEnv,
          request,
          user: mockUser,
        }),
      ).rejects.toThrow("Missing required parameter: messages");
    });

    it("should throw error for empty messages array", async () => {
      const request = { messages: [] } as any;

      await expect(() =>
        handleCreateChatCompletions({
          env: mockEnv,
          request,
          user: mockUser,
        }),
      ).rejects.toThrow("Missing required parameter: messages");
    });

    it("should throw error when only display-only compaction messages are provided", async () => {
      const request = {
        messages: [
          {
            role: "compaction",
            content: "Context compacted",
            parts: [
              {
                type: "compaction",
                status: "completed",
                label: "Context compacted",
              },
            ],
          },
        ],
      } as any;

      await expect(() =>
        handleCreateChatCompletions({
          env: mockEnv,
          request,
          user: mockUser,
        }),
      ).rejects.toThrow("Missing required parameter: messages");
      expect(mockProcessChatRequest).not.toHaveBeenCalled();
    });

    it("should remove display-only compaction messages before processing mixed requests", async () => {
      const request = {
        messages: [
          { id: "user-1", role: "user", content: "Hello" },
          {
            id: "compaction-1",
            role: "compaction",
            content: "Context compacted",
            parts: [
              {
                type: "compaction",
                status: "completed",
                label: "Context compacted",
              },
            ],
          },
        ],
        model: "gpt-4",
      } as any;

      mockProcessChatRequest.mockResolvedValue({
        response: {
          response: "Hello!",
        },
        selectedModel: "gpt-4",
      });
      mockFormatAssistantMessage.mockReturnValue({
        content: "Hello!",
        model: "gpt-4",
        finish_reason: "stop",
      });

      await handleCreateChatCompletions({
        env: mockEnv,
        request,
        user: mockUser,
      });

      expect(mockProcessChatRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ id: "user-1", role: "user", content: "Hello" }],
        }),
      );
    });

    it("preserves an explicit provider service tier", async () => {
      mockProcessChatRequest.mockResolvedValue({
        response: { response: "Hello!" },
        selectedModel: "gpt-6-astra",
      });
      mockFormatAssistantMessage.mockReturnValue({
        content: "Hello!",
        model: "gpt-6-astra",
        finish_reason: "stop",
      });

      await handleCreateChatCompletions({
        env: mockEnv,
        request: {
          messages: [{ role: "user", content: "Hello" }],
          model: "gpt-6-astra",
          service_tier: "fast",
        },
        user: mockUser,
      });

      expect(mockProcessChatRequest).toHaveBeenCalledWith(
        expect.objectContaining({ service_tier: "fast" }),
      );
    });
  });

  describe("connector approval continuation", () => {
    it("rejects approval continuation without an authenticated user", async () => {
      await expect(
        handleCreateChatCompletions({
          env: mockEnv,
          request: {
            completion_id: "completion-with-approval",
            connector_approval_id: "coa_action",
            messages: [],
          } as any,
        }),
      ).rejects.toMatchObject({ statusCode: 401 });
      expect(mockProcessChatRequest).not.toHaveBeenCalled();
    });

    it("replays the authoritative stored action and only asks the model to summarise", async () => {
      const { replayApprovedConnectorOperation } =
        await import("~/modules/apps/application/connectors/approved-operation-replay");
      const completionId = "completion-with-approval";
      const authoritativeToolCall = {
        id: "call-authoritative",
        type: "function" as const,
        function: {
          name: "use_recipe_connector" as const,
          arguments: '{"provider":"gmail","operation":"GMAIL_CREATE_DRAFT","sessionId":"ccs_1"}',
        },
      };
      const authoritativeToolResult = {
        id: "result-authoritative",
        role: "tool",
        name: "use_recipe_connector",
        tool_call_id: authoritativeToolCall.id,
        status: "success",
        content: "Draft created",
      };

      vi.mocked(replayApprovedConnectorOperation).mockResolvedValue({
        toolCall: authoritativeToolCall,
        toolResult: authoritativeToolResult as any,
        summaryMessages: [
          { role: "user", content: "Create the stored draft" },
          {
            role: "assistant",
            content: "",
            tool_calls: [authoritativeToolCall],
          },
          authoritativeToolResult,
        ] as any,
      });
      const context = {
        env: mockEnv,
        connectorRunId: "connector_run_new",
        database: {},
        requestCache: new Map(),
        ensureDatabase: vi.fn(),
        repositories: {
          connectorOperationApprovals: {
            getResumableByIdForUser: vi.fn().mockResolvedValue({
              id: "coa_action",
              state: "approved",
              expiresAt: "2099-01-01T00:00:00.000Z",
              completionId,
              runId: "connector_run_approved",
            }),
          },
          teammateContexts: {
            getByHomeConversationId: vi.fn().mockResolvedValue(null),
          },
        },
      } as any;
      const request = {
        completion_id: completionId,
        connector_approval_id: "coa_action",
        messages: [],
        model: "gpt-4",
      } as any;

      mockProcessChatRequest.mockResolvedValue({
        response: { response: "Draft created" },
        selectedModel: "gpt-4",
      });
      mockFormatAssistantMessage.mockReturnValue({
        content: "Draft created",
        model: "gpt-4",
        finish_reason: "stop",
      });

      await handleCreateChatCompletions({
        env: mockEnv,
        request,
        user: mockUser,
        context,
      });

      expect(replayApprovedConnectorOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          approval: expect.objectContaining({
            runId: "connector_run_approved",
          }),
          context,
          user: mockUser,
        }),
      );
      expect(mockConversationManagerGetInstance).toHaveBeenCalledWith(
        expect.objectContaining({ writeFence: mockThreadLease }),
      );
      expect(mockProcessChatRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          disable_functions: true,
          conversation_history_write_mode: "append",
          connector_approval_id: undefined,
          approved_tools: [],
          messages: [
            { role: "user", content: "Create the stored draft" },
            {
              role: "assistant",
              content: "",
              tool_calls: [authoritativeToolCall],
            },
            authoritativeToolResult,
          ],
        }),
      );
    });
  });

  describe("guardrails handling", () => {
    it("should handle validation failure", async () => {
      const request = {
        messages: [{ role: "user", content: "Inappropriate content" }],
      } as any;

      const mockValidationResult = {
        validation: true,
        error: "Content violates policy",
        selectedModel: "gpt-4",
      };

      mockProcessChatRequest.mockResolvedValue(mockValidationResult);
      mockFormatAssistantMessage.mockReturnValue({
        content: "Content violates policy",
        model: "gpt-4",
        guardrails: {
          passed: false,
          error: "Content violates policy",
        },
        finish_reason: "content_filter",
        usage: { total_tokens: 0 },
      });

      const result = await handleCreateChatCompletions({
        env: mockEnv,
        request,
        user: mockUser,
      });

      // @ts-expect-error - mock result
      expect(result.choices[0].finish_reason).toBe("content_filter");
      // @ts-expect-error - mock result
      expect(result.post_processing.guardrails.passed).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should throw error when processChatRequest returns unexpected result", async () => {
      const request = {
        messages: [{ role: "user", content: "Hello" }],
      } as any;

      mockProcessChatRequest.mockResolvedValue({
        unexpected: "result",
      });

      await expect(() =>
        handleCreateChatCompletions({
          env: mockEnv,
          request,
          user: mockUser,
        }),
      ).rejects.toThrow("Unexpected error processing chat request");
    });

    it("should throw error when no response is generated", async () => {
      const request = {
        messages: [{ role: "user", content: "Hello" }],
      } as any;

      mockProcessChatRequest.mockResolvedValue({
        response: null,
      });

      await expect(() =>
        handleCreateChatCompletions({
          env: mockEnv,
          request,
          user: mockUser,
        }),
      ).rejects.toThrow("No response generated by the model");
    });
  });

  describe("tool responses handling", () => {
    it("should include non-streaming tool step metadata in post processing", async () => {
      const request = {
        messages: [{ role: "user", content: "Hello" }],
      } as any;
      const steps = [
        {
          stepNumber: 1,
          stepType: "tool-call",
          toolCallCount: 1,
          toolResultCount: 1,
          usage: { total_tokens: 50 },
        },
        {
          stepNumber: 2,
          stepType: "final",
          toolCallCount: 0,
          toolResultCount: 0,
          usage: { total_tokens: 100 },
        },
      ];

      mockProcessChatRequest.mockResolvedValue({
        response: {
          response: "Using tool",
          usage: { total_tokens: 150 },
          totalUsage: { total_tokens: 150 },
          steps,
        },
        selectedModel: "gpt-4",
        toolResponses: [],
      });
      mockFormatAssistantMessage.mockReturnValue({
        content: "Using tool",
        model: "gpt-4",
        usage: { total_tokens: 150 },
        finish_reason: "stop",
      });

      const result = await handleCreateChatCompletions({
        env: mockEnv,
        request,
        user: mockUser,
      });

      // @ts-expect-error - mock result
      expect(result.usage).toEqual({ total_tokens: 150 });
      // @ts-expect-error - mock result
      expect(result.post_processing.steps).toEqual(steps);
      // @ts-expect-error - mock result
      expect(result.post_processing.total_usage).toEqual({ total_tokens: 150 });
    });

    it("should include tool responses in choices", async () => {
      const request = {
        messages: [{ role: "user", content: "Hello" }],
        tools: [{ type: "function", function: { name: "test_tool" } }],
      } as any;

      const mockResponse = {
        response: {
          response: "Using tool",
          usage: { total_tokens: 50 },
        },
        selectedModel: "gpt-4",
        toolResponses: [
          {
            id: "tool_123",
            role: "tool",
            name: "test_tool",
            content: "Tool result",
            status: "success",
            tool_call_id: "call-test-tool",
            tool_call_arguments: '{"input":"value"}',
            timestamp: "2023-01-01T00:00:00Z",
          },
        ],
      };

      mockProcessChatRequest.mockResolvedValue(mockResponse);
      mockFormatAssistantMessage.mockReturnValue({
        content: "Using tool",
        model: "gpt-4",
        usage: { total_tokens: 50 },
        finish_reason: "stop",
      });

      const result = await handleCreateChatCompletions({
        env: mockEnv,
        request,
        user: mockUser,
      });

      // @ts-expect-error - mock result
      expect(result.choices).toHaveLength(2);
      // @ts-expect-error - mock result
      expect(result.choices[1]).toEqual({
        index: 1,
        message: {
          id: "tool_123",
          log_id: "test-log-id",
          role: "tool",
          name: "test_tool",
          content: "Tool result",
          parts: expect.arrayContaining([
            expect.objectContaining({
              type: "tool_result",
              name: "test_tool",
            }),
          ]),
          citations: null,
          data: null,
          status: "success",
          timestamp: "2023-01-01T00:00:00Z",
          tool_call_id: "call-test-tool",
          tool_call_arguments: '{"input":"value"}',
        },
        finish_reason: "tool_result",
      });
    });

    it("should expose compaction markers as post-processing metadata, not choices", async () => {
      const request = {
        messages: [{ role: "user", content: "Hello" }],
        compaction: "auto",
      } as any;
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

      mockProcessChatRequest.mockResolvedValue({
        response: {
          response: "Hello",
          usage: { total_tokens: 20 },
        },
        selectedModel: "gpt-4",
        compactionMessage,
      });
      mockFormatAssistantMessage.mockReturnValue({
        content: "Hello",
        model: "gpt-4",
        usage: { total_tokens: 20 },
        finish_reason: "stop",
      });

      const result = await handleCreateChatCompletions({
        env: mockEnv,
        request,
        user: mockUser,
      });

      // @ts-expect-error - mock result
      expect(result.choices).toHaveLength(1);
      // @ts-expect-error - mock result
      expect(result.post_processing.compaction).toEqual({
        message: compactionMessage,
      });
    });
  });
});
