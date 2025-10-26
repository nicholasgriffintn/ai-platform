import { describe, expect, it, vi, beforeEach } from "vitest";

const getAsyncInvocationStatusMock = vi.fn();

vi.mock("~/lib/providers/bedrock", () => ({
  BedrockProvider: class {
    getAsyncInvocationStatus = getAsyncInvocationStatusMock;
  },
}));

import { refreshAsyncMessages } from "~/services/completions/refreshAsyncMessages";

describe("refreshAsyncMessages", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getAsyncInvocationStatusMock.mockReset();
  });

  it("should update messages when async invocation completes", async () => {
    const updateMock = vi.fn();
    const conversationManager = {
      update: updateMock,
    } as any;

    const message = {
      id: "message-1",
      status: "in_progress",
      model: "amazon.nova-reel-v1:1",
      data: {
        asyncInvocation: {
          provider: "bedrock",
          invocationArn: "arn:aws:bedrock:us-east-1:123456789012:async-invoke/xyz",
        },
        attachments: [{ type: "text", url: "https://example.com" }],
      },
      content: "Generating...",
      role: "assistant",
    };

    getAsyncInvocationStatusMock.mockResolvedValue({
      status: "completed",
      result: {
        response: "Completed",
        data: {
          video: {
            url: "https://assets.example.com/video.mp4",
          },
        },
      },
      raw: {},
    });

    const refreshedMessages = await refreshAsyncMessages({
      conversationManager,
      conversationId: "conversation-1",
      env: {} as any,
      user: { id: 1 } as any,
      messages: [message as any],
    });

    expect(updateMock).toHaveBeenCalled();
    expect(refreshedMessages[0].status).toBe("completed");
    expect(refreshedMessages[0].data?.video?.url).toBe(
      "https://assets.example.com/video.mp4",
    );
    expect(refreshedMessages[0].data?.attachments).toEqual([
      { type: "text", url: "https://example.com" },
    ]);
    expect(
      (refreshedMessages[0].data?.asyncInvocation as any)?.status,
    ).toBe("completed");
  });

  it("should leave messages unchanged when no async invocation metadata is present", async () => {
    const conversationManager = {
      update: vi.fn(),
    } as any;

    const message = {
      id: "message-2",
      status: "completed",
      model: "model",
      content: "done",
      role: "assistant",
    };

    const refreshedMessages = await refreshAsyncMessages({
      conversationManager,
      conversationId: "conversation-1",
      env: {} as any,
      user: { id: 1 } as any,
      messages: [message as any],
    });

    expect(refreshedMessages[0]).toEqual(message);
    expect(conversationManager.update).not.toHaveBeenCalled();
  });

  it("should skip polling for unsupported providers", async () => {
    const conversationManager = {
      update: vi.fn(),
    } as any;

    const message = {
      id: "message-3",
      status: "in_progress",
      model: "model",
      role: "assistant",
      data: {
        asyncInvocation: {
          provider: "unknown",
          invocationArn: "arn:aws:bedrock:::async-invoke/abc",
        },
      },
    };

    const refreshedMessages = await refreshAsyncMessages({
      conversationManager,
      conversationId: "conversation-2",
      env: {} as any,
      user: { id: 1 } as any,
      messages: [message as any],
    });

    expect(refreshedMessages[0]).toEqual(message);
    expect(conversationManager.update).not.toHaveBeenCalled();
  });
});
