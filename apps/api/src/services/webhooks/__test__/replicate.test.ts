import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IRequest, Message } from "~/types";
import { handleReplicateWebhook } from "../replicate";

vi.mock("~/lib/conversationManager", () => ({
  ConversationManager: {
    getInstance: vi.fn().mockReturnValue({
      getFromWebhook: vi.fn(),
      updateFromWebhook: vi.fn(),
    }),
  },
}));

vi.mock("~/lib/database", () => ({
  Database: {
    getInstance: vi.fn().mockReturnValue({}),
  },
}));

const mockRequest: IRequest = {
  env: {
    DB: "mock-db",
  },
  request: {
    id: "replicate-123",
    status: "completed",
    output: "Generated content",
  },
} as any;

describe("handleReplicateWebhook", () => {
  let mockConversationManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const conversationModule = await import("~/lib/conversationManager");
    // @ts-expect-error - mock implementation
    mockConversationManager = vi.mocked(
      conversationModule.ConversationManager.getInstance,
    )();
  });

  describe("parameter validation", () => {
    it("should throw error if DB binding is missing", async () => {
      const req = {
        env: {},
        request: mockRequest.request,
      } as IRequest;

      await expect(handleReplicateWebhook(req, "webhook-id")).rejects.toThrow(
        "Missing DB binding",
      );
    });

    it("should throw error if request is missing", async () => {
      const req = {
        env: { DB: "mock-db" },
        request: null,
      } as any;

      await expect(handleReplicateWebhook(req, "webhook-id")).rejects.toThrow(
        "Missing request",
      );
    });
  });

  describe("webhook processing", () => {
    it("should process webhook successfully", async () => {
      const mockMessages: Message[] = [
        {
          id: "msg-1",
          role: "user",
          content: "Test message",
          data: { id: "replicate-123", status: "processing" },
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "Previous response",
          data: { id: "other-id" },
        },
      ];

      mockConversationManager.getFromWebhook.mockResolvedValue(mockMessages);

      const result = await handleReplicateWebhook(mockRequest, "webhook-id");

      expect(mockConversationManager.getFromWebhook).toHaveBeenCalledWith(
        "webhook-id",
      );
      expect(mockConversationManager.updateFromWebhook).toHaveBeenCalledWith(
        "webhook-id",
        [
          {
            ...mockMessages[0],
            data: {
              ...mockMessages[0].data,
              ...mockRequest.request,
            },
          },
          mockMessages[1],
        ],
      );
      expect(result).toEqual(mockMessages);
    });

    it("should throw error if no items found", async () => {
      mockConversationManager.getFromWebhook.mockResolvedValue([]);

      await expect(
        handleReplicateWebhook(mockRequest, "webhook-id"),
      ).rejects.toThrow("Item not found");
    });

    it("should throw error if no items returned", async () => {
      mockConversationManager.getFromWebhook.mockResolvedValue(null);

      await expect(
        handleReplicateWebhook(mockRequest, "webhook-id"),
      ).rejects.toThrow("Item not found");
    });

    it("should throw error if matching message not found", async () => {
      const mockMessages: Message[] = [
        {
          id: "msg-1",
          role: "user",
          content: "Test message",
          data: { id: "different-id" },
        },
      ];

      mockConversationManager.getFromWebhook.mockResolvedValue(mockMessages);

      await expect(
        handleReplicateWebhook(mockRequest, "webhook-id"),
      ).rejects.toThrow(
        "Message from webhook-id with item id replicate-123 not found",
      );
    });

    it("should update correct message while preserving others", async () => {
      const mockMessages: Message[] = [
        {
          id: "msg-1",
          role: "user",
          content: "User message",
          data: { id: "other-request" },
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "Assistant response",
          data: { id: "replicate-123", status: "processing" },
        },
        {
          id: "msg-3",
          role: "user",
          content: "Another message",
          data: { id: "another-request" },
        },
      ];

      mockConversationManager.getFromWebhook.mockResolvedValue(mockMessages);

      const result = await handleReplicateWebhook(mockRequest, "webhook-id");

      const expectedUpdatedMessages = [
        mockMessages[0],
        {
          ...mockMessages[1],
          data: {
            id: "replicate-123",
            status: "completed",
            output: "Generated content",
          },
        },
        mockMessages[2],
      ];

      expect(mockConversationManager.updateFromWebhook).toHaveBeenCalledWith(
        "webhook-id",
        expectedUpdatedMessages,
      );
      expect(result).toEqual(mockMessages);
    });

    it("should handle message with null data", async () => {
      const mockMessages: Message[] = [
        {
          id: "msg-1",
          role: "user",
          content: "Test message",
          data: null,
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "Assistant response",
          data: { id: "replicate-123" },
        },
      ];

      mockConversationManager.getFromWebhook.mockResolvedValue(mockMessages);

      const result = await handleReplicateWebhook(mockRequest, "webhook-id");

      expect(mockConversationManager.updateFromWebhook).toHaveBeenCalledWith(
        "webhook-id",
        [
          mockMessages[0],
          {
            ...mockMessages[1],
            data: {
              ...mockMessages[1].data,
              ...mockRequest.request,
            },
          },
        ],
      );
      expect(result).toEqual(mockMessages);
    });
  });

  describe("conversation manager integration", () => {
    it("should initialize ConversationManager with correct parameters", async () => {
      const mockMessages: Message[] = [
        {
          id: "msg-1",
          role: "assistant",
          content: "Test",
          data: { id: "replicate-123" },
        },
      ];

      mockConversationManager.getFromWebhook.mockResolvedValue(mockMessages);

      await handleReplicateWebhook(mockRequest, "webhook-id");

      const conversationModule = await import("~/lib/conversationManager");
      expect(
        conversationModule.ConversationManager.getInstance,
      ).toHaveBeenCalledWith({
        database: {},
        model: "replicate",
        platform: "api",
      });
    });
  });

  describe("data merging", () => {
    it("should merge request data with existing message data", async () => {
      const mockMessages: Message[] = [
        {
          id: "msg-1",
          role: "assistant",
          content: "Test message",
          data: {
            id: "replicate-123",
            status: "processing",
            created_at: "2024-01-01T00:00:00Z",
          },
        },
      ];

      const requestWithMoreData = {
        ...mockRequest,
        request: {
          id: "replicate-123",
          status: "completed",
          output: "Final result",
          completed_at: "2024-01-01T01:00:00Z",
        },
      };

      mockConversationManager.getFromWebhook.mockResolvedValue(mockMessages);

      // @ts-expect-error - mock request
      await handleReplicateWebhook(requestWithMoreData, "webhook-id");

      const expectedUpdatedMessage = {
        ...mockMessages[0],
        data: {
          id: "replicate-123",
          status: "completed",
          created_at: "2024-01-01T00:00:00Z",
          output: "Final result",
          completed_at: "2024-01-01T01:00:00Z",
        },
      };

      expect(mockConversationManager.updateFromWebhook).toHaveBeenCalledWith(
        "webhook-id",
        [expectedUpdatedMessage],
      );
    });
  });
});
