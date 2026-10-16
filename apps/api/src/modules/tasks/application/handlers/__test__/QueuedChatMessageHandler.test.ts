import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  latestRun: vi.fn(),
  startResponse: vi.fn(),
}));

vi.mock("~/infrastructure/context/serviceContext", () => ({
  createServiceContext: () => ({
    requestCache: {},
    repositories: fakeRepositories([
      [ConversationRunRepository, { getLatestForConversation: mocks.latestRun }],
      [UserRepository, { getUserById: async () => ({ id: 7 }) }],
      [
        ConversationRepository,
        {
          getConversation: async () => ({ id: "conversation-1", user_id: 7, project_id: null }),
        },
      ],
    ]),
  }),
}));

vi.mock("~/modules/conversations/application/manager", () => ({
  ConversationManager: { getInstance: () => ({ get: async () => [] }) },
}));

vi.mock("~/modules/responses/application/start", () => ({
  startResponse: mocks.startResponse,
}));

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

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
    expect(mocks.startResponse).not.toHaveBeenCalled();
  });

  it("sends the queued turn with the task id as its command id", async () => {
    await new QueuedChatMessageHandler().handle(message, {} as never);

    expect(mocks.startResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.objectContaining({
          command_id: "queued_chat_1",
          completion_id: "conversation-1",
          stream: false,
        }),
      }),
    );
  });

  it("goes back to waiting when the conversation is busy", async () => {
    mocks.startResponse.mockRejectedValue(
      new AssistantError("busy", ErrorType.CONFLICT_ERROR, 409),
    );

    await expect(
      new QueuedChatMessageHandler().handle(message, {} as never),
    ).resolves.toMatchObject({ status: "suspended" });
  });
});
