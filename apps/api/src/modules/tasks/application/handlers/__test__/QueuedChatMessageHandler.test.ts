import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  latestRun: vi.fn(),
  handleCreateChatCompletions: vi.fn(),
}));

vi.mock("~/infrastructure/context/serviceContext", () => ({
  createServiceContext: () => ({
    database: {},
    requestCache: {},
    repositories: {
      conversationRuns: { getLatestForConversation: mocks.latestRun },
      users: { getUserById: async () => ({ id: 7 }) },
      conversations: {
        getConversation: async () => ({ id: "conversation-1", user_id: 7, project_id: null }),
      },
    },
  }),
}));

vi.mock("~/modules/conversations/application/manager", () => ({
  ConversationManager: { getInstance: () => ({ get: async () => [] }) },
}));

vi.mock("~/modules/completions/application/createChatCompletions", () => ({
  handleCreateChatCompletions: mocks.handleCreateChatCompletions,
}));

import { QueuedChatMessageHandler } from "../QueuedChatMessageHandler";

const message = {
  taskId: "queued_chat_1",
  task_type: "queued_chat_message",
  user_id: 7,
  task_data: {
    conversationId: "conversation-1",
    message: { role: "user", content: "And then?" },
    request: {},
  },
} as never;

describe("QueuedChatMessageHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.latestRun.mockResolvedValue({ status: "succeeded" });
  });

  it("waits while a reply is still running", async () => {
    mocks.latestRun.mockResolvedValue({ status: "running" });

    await expect(
      new QueuedChatMessageHandler().handle(message, {} as never),
    ).resolves.toMatchObject({ status: "suspended" });
    expect(mocks.handleCreateChatCompletions).not.toHaveBeenCalled();
  });

  it("sends the queued turn with the task id as its command id", async () => {
    await new QueuedChatMessageHandler().handle(message, {} as never);

    expect(mocks.handleCreateChatCompletions).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          command_id: "queued_chat_1",
          completion_id: "conversation-1",
          stream: false,
        }),
      }),
    );
  });

  it("goes back to waiting when the conversation is busy", async () => {
    mocks.handleCreateChatCompletions.mockRejectedValue(
      new AssistantError("busy", ErrorType.CONFLICT_ERROR, 409),
    );

    await expect(
      new QueuedChatMessageHandler().handle(message, {} as never),
    ).resolves.toMatchObject({ status: "suspended" });
  });
});
