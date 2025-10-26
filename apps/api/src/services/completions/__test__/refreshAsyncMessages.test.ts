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
      },
      content: "Generating...",
      role: "assistant",
    };

    getAsyncInvocationStatusMock.mockResolvedValue({
      status: "completed",
      result: {
        response: "Completed",
        data: {},
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
});
