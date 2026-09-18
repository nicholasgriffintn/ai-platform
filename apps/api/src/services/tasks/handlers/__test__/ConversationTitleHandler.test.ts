import { CONVERSATION_TITLE_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  conversationAudience: vi.fn(),
  createServiceContext: vi.fn(),
  generateConversationTitle: vi.fn(),
  publishConversationChanged: vi.fn(),
}));

vi.mock("~/lib/context/serviceContext", () => ({
  createServiceContext: mocks.createServiceContext,
}));
vi.mock("~/services/conversations/title-generation", () => ({
  generateConversationTitle: mocks.generateConversationTitle,
}));
vi.mock("~/services/sync/audience", () => ({
  conversationAudience: mocks.conversationAudience,
}));
vi.mock("~/services/sync/conversation-events", () => ({
  publishConversationChanged: mocks.publishConversationChanged,
}));

import { ConversationTitleHandler } from "../ConversationTitleHandler";

const getUserById = vi.fn();
const getConversation = vi.fn();
const updateConversation = vi.fn();
const getConversationMessages = vi.fn();

function buildHandler() {
  return new ConversationTitleHandler();
}

function buildMessage(overrides: Record<string, unknown> = {}) {
  return {
    taskId: "conversation_title:conversation-1:message-2",
    task_type: CONVERSATION_TITLE_TASK_TYPE,
    user_id: 42,
    priority: 6,
    task_data: { conversationId: "conversation-1" },
    ...overrides,
  } as never as Parameters<ConversationTitleHandler["handle"]>[0];
}

describe("ConversationTitleHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getUserById.mockResolvedValue({ id: 42, plan_id: "pro" });
    getConversation.mockResolvedValue({ id: "conversation-1", title: "help me" });
    mocks.conversationAudience.mockResolvedValue([42]);
    getConversationMessages.mockResolvedValue([
      { id: "message-1", role: "user", content: "help me", timestamp: 1 },
      { id: "message-2", role: "assistant", content: "Sure, what broke?", timestamp: 2 },
    ]);
    mocks.createServiceContext.mockReturnValue({
      env: {},
      repositories: {
        users: { getUserById },
        conversations: { getConversation, updateConversation },
        messages: { getConversationMessages },
      },
    });
    mocks.generateConversationTitle.mockResolvedValue("Fixing a flaky test");
    mocks.publishConversationChanged.mockImplementation(async (publisher: any) => {
      publisher.waitUntil?.(Promise.resolve());
    });
  });

  it("generates and publishes a richer title for a thin opening message", async () => {
    const result = await buildHandler().handle(buildMessage(), {} as never);

    expect(result).toMatchObject({
      status: "success",
      data: { title: "Fixing a flaky test" },
    });
    expect(updateConversation).toHaveBeenCalledWith("conversation-1", {
      title: "Fixing a flaky test",
    });
    expect(mocks.publishConversationChanged).toHaveBeenCalledWith(
      expect.objectContaining({ waitUntil: expect.any(Function) }),
      "conversation-1",
      { title: "Fixing a flaky test" },
    );
  });

  it("skips when the opening message already carries enough context", async () => {
    getConversationMessages.mockResolvedValue([
      {
        id: "message-1",
        role: "user",
        content: "Explain how Durable Objects keep a conversation serialised for concurrent turns",
        timestamp: 1,
      },
    ]);

    const result = await buildHandler().handle(buildMessage(), {} as never);

    expect(result.status).toBe("skipped");
    expect(mocks.generateConversationTitle).not.toHaveBeenCalled();
    expect(updateConversation).not.toHaveBeenCalled();
  });

  it("skips when the conversation no longer exists", async () => {
    getConversation.mockResolvedValue(null);

    const result = await buildHandler().handle(buildMessage(), {} as never);

    expect(result.status).toBe("skipped");
    expect(mocks.generateConversationTitle).not.toHaveBeenCalled();
  });

  it("skips when the user is not in the conversation audience", async () => {
    mocks.conversationAudience.mockResolvedValue([7]);

    const result = await buildHandler().handle(buildMessage(), {} as never);

    expect(result.status).toBe("skipped");
    expect(getConversation).not.toHaveBeenCalled();
    expect(mocks.generateConversationTitle).not.toHaveBeenCalled();
  });

  it("skips when the title is unchanged", async () => {
    getConversation.mockResolvedValue({ id: "conversation-1", title: "Fixing a flaky test" });

    const result = await buildHandler().handle(buildMessage(), {} as never);

    expect(result.status).toBe("skipped");
    expect(updateConversation).not.toHaveBeenCalled();
  });

  it("rejects task data without a conversation id", async () => {
    const result = await buildHandler().handle(buildMessage({ task_data: {} }), {} as never);

    expect(result.status).toBe("error");
    expect(getConversation).not.toHaveBeenCalled();
  });
});
