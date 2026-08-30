import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateConversationTitle: vi.fn(),
}));

vi.mock("~/lib/conversation/title-generation", () => ({
  generateConversationTitle: mocks.generateConversationTitle,
}));

import { createConversationTitleExcerpt } from "@ngriffin_uk/polychat-schemas";

import { startConversationTitle } from "../conversation-title";

const OPENING = "Explain how Durable Objects keep a conversation serialised";

function createParams(overrides: Record<string, unknown> = {}) {
  const conversation = {
    title: createConversationTitleExcerpt(OPENING),
    message_count: 1,
    ...(overrides.conversation as Record<string, unknown>),
  };
  const conversationManager = {
    getConversationMetadata: vi.fn(async () => conversation),
    updateConversation: vi.fn(async () => ({})),
  };
  const sink = { writeEvent: vi.fn(async () => {}) };

  return {
    completionId: "completion-1",
    conversationManager,
    messages: [{ role: "user", content: OPENING }],
    sink,
    context: { user: { id: 42 } },
    store: true,
    ...overrides,
  } as never as Parameters<typeof startConversationTitle>[0] & {
    conversationManager: typeof conversationManager;
    sink: typeof sink;
  };
}

describe("startConversationTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateConversationTitle.mockResolvedValue("Durable Object concurrency");
  });

  it("titles the conversation from the opening message before the answer lands", async () => {
    const params = createParams();
    const run = startConversationTitle(params);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(params.sink.writeEvent).toHaveBeenCalledTimes(1);

    expect(params.conversationManager.updateConversation).toHaveBeenCalledWith("completion-1", {
      title: "Durable Object concurrency",
    });
    expect(params.sink.writeEvent).toHaveBeenCalledWith("state", {
      state: "conversation_title",
      title: "Durable Object concurrency",
    });
    expect(await run.complete({ role: "assistant", content: "..." } as never)).toBe(
      "Durable Object concurrency",
    );
    expect(mocks.generateConversationTitle).toHaveBeenCalledTimes(1);
  });

  it("retitles once the answer lands when the opening said too little", async () => {
    const params = createParams({
      messages: [{ role: "user", content: "help me" }],
      conversation: { title: "help me", message_count: 1 },
    });
    const run = startConversationTitle(params);

    mocks.generateConversationTitle.mockResolvedValueOnce("Asking for help");
    mocks.generateConversationTitle.mockResolvedValueOnce("Fixing a flaky test");

    expect(await run.complete({ role: "assistant", content: "..." } as never)).toBe(
      "Fixing a flaky test",
    );
    expect(params.sink.writeEvent).toHaveBeenLastCalledWith("state", {
      state: "conversation_title",
      title: "Fixing a flaky test",
    });
  });

  it("leaves a title someone has already chosen alone", async () => {
    const params = createParams({ conversation: { title: "Weekly planning", message_count: 1 } });

    expect(await startConversationTitle(params).complete()).toBeNull();
    expect(mocks.generateConversationTitle).not.toHaveBeenCalled();
    expect(params.conversationManager.updateConversation).not.toHaveBeenCalled();
  });

  it("leaves conversations that are already under way alone", async () => {
    const params = createParams({
      conversation: { title: createConversationTitleExcerpt(OPENING), message_count: 6 },
    });

    expect(await startConversationTitle(params).complete()).toBeNull();
    expect(mocks.generateConversationTitle).not.toHaveBeenCalled();
  });

  it("keeps the turn going when titling fails", async () => {
    const params = createParams();

    mocks.generateConversationTitle.mockRejectedValue(new Error("provider down"));

    expect(await startConversationTitle(params).complete()).toBeNull();
    expect(params.sink.writeEvent).not.toHaveBeenCalled();
  });

  it("does not title unstored turns", async () => {
    const params = createParams({ store: false });

    expect(await startConversationTitle(params).complete()).toBeNull();
    expect(params.conversationManager.getConversationMetadata).not.toHaveBeenCalled();
  });
});
