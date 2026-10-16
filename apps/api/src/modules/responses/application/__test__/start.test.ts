import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ConnectorOperationApprovalRepository } from "~/modules/connectors/infrastructure/ConnectorOperationApprovalRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";

import { startResponse } from "../start";

const { mockConversationManagerGetInstance, mockThreadLease } = vi.hoisted(() => ({
  mockConversationManagerGetInstance: vi.fn(() => ({
    getAllMessages: vi.fn(),
  })),
  mockThreadLease: {
    assertOwned: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
  },
}));

vi.mock("~/modules/responses/application/engine/core", () => ({
  processChatRequest: vi.fn(),
}));

vi.mock("~/modules/responses/application/engine/messages/assistant-format", () => ({
  formatAssistantMessage: vi.fn(),
}));

vi.mock("~/modules/conversations/application/manager", () => ({
  ConversationManager: { getInstance: mockConversationManagerGetInstance },
}));

vi.mock("~/modules/conversations/infrastructure/coordinator/client", () => ({
  withThreadLock: vi.fn(async (_params, run) => run(mockThreadLease)),
}));

vi.mock("~/modules/connectors/application/approved-operation-replay", () => ({
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

describe("startResponse", () => {
  let mockProcessChatRequest: any;
  let mockFormatAssistantMessage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { processChatRequest } = await import("~/modules/responses/application/engine/core");
    const { formatAssistantMessage } =
      await import("~/modules/responses/application/engine/messages/assistant-format");

    mockProcessChatRequest = vi.mocked(processChatRequest);
    mockFormatAssistantMessage = vi.mocked(formatAssistantMessage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("parameter validation", () => {
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
        startResponse({
          env: mockEnv,
          command: request,
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
        settings: { model: "gpt-4" },
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

      await startResponse({
        env: mockEnv,
        command: request,
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

      await startResponse({
        env: mockEnv,
        command: {
          messages: [{ role: "user", content: "Hello" }],
          settings: { model: "gpt-6-astra", service_tier: "fast" },
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
        startResponse({
          env: mockEnv,
          command: {
            conversationId: "completion-with-approval",
            messages: [],
            settings: { connector_approval_id: "coa_action" },
          },
        }),
      ).rejects.toMatchObject({ statusCode: 401 });
      expect(mockProcessChatRequest).not.toHaveBeenCalled();
    });

    it("replays the authoritative stored action and only asks the model to summarise", async () => {
      const { replayApprovedConnectorOperation } =
        await import("~/modules/connectors/application/approved-operation-replay");
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
        requestCache: new Map(),
        ensureDatabase: vi.fn(),
        repositories: fakeRepositories([
          [
            ConnectorOperationApprovalRepository,
            {
              getResumableByIdForUser: vi.fn().mockResolvedValue({
                id: "coa_action",
                state: "approved",
                expiresAt: "2099-01-01T00:00:00.000Z",
                completionId,
                runId: "connector_run_approved",
              }),
            },
          ],
          [
            TeammateContextRepository,
            {
              getByHomeConversationId: vi.fn().mockResolvedValue(null),
            },
          ],
        ]),
      } as any;
      const request = {
        conversationId: completionId,
        messages: [],
        settings: { connector_approval_id: "coa_action", model: "gpt-4" },
      };

      mockProcessChatRequest.mockResolvedValue({
        response: { response: "Draft created" },
        selectedModel: "gpt-4",
      });
      mockFormatAssistantMessage.mockReturnValue({
        content: "Draft created",
        model: "gpt-4",
        finish_reason: "stop",
      });

      await startResponse({
        env: mockEnv,
        command: request,
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

      const result = await startResponse({
        env: mockEnv,
        command: request,
        user: mockUser,
      });

      // @ts-expect-error - mock result
      expect(result.usage).toEqual({ total_tokens: 150 });
      // @ts-expect-error - mock result
      expect(result.post_processing.steps).toEqual(steps);
      // @ts-expect-error - mock result
      expect(result.post_processing.total_usage).toEqual({ total_tokens: 150 });
    });

    it("should expose compaction markers as post-processing metadata, not choices", async () => {
      const request = {
        messages: [{ role: "user", content: "Hello" }],
        settings: { compaction: "auto" },
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

      const result = await startResponse({
        env: mockEnv,
        command: request,
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
