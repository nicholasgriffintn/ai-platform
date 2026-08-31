import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationManager } from "~/lib/conversationManager";
import type { CoreChatOptions, Message } from "~/types";

import { storeUserTurn } from "../message-store";

function userMessage(content: string, overrides: Partial<Message> = {}): Message {
  return { role: "user", content, ...overrides } as Message;
}

function snapshotMessage(content: string): Message {
  return {
    role: "assistant",
    content,
    parts: [{ type: "snapshot", summary: content }],
  } as unknown as Message;
}

function goalMarkerMessage(timestamp = 10): Message {
  return {
    id: "goal-marker-1",
    role: "goal",
    content: "Goal started",
    timestamp,
    parts: [{ type: "goal", event: "set", objective: "Ship it", timestamp }],
  };
}

function createConversationManager(stored: Message[] | null) {
  return {
    get: vi.fn().mockResolvedValue(stored),
    addBatch: vi.fn().mockResolvedValue(undefined),
    replaceMessages: vi.fn().mockResolvedValue(undefined),
  } as unknown as ConversationManager & {
    get: ReturnType<typeof vi.fn>;
    addBatch: ReturnType<typeof vi.fn>;
    replaceMessages: ReturnType<typeof vi.fn>;
  };
}

function baseOptions(overrides: Partial<CoreChatOptions> = {}): CoreChatOptions {
  return {
    env: {} as any,
    completion_id: "conv-1",
    platform: "api",
    mode: "normal",
    messages: [],
    ...overrides,
  } as CoreChatOptions;
}

async function run(
  conversationManager: ReturnType<typeof createConversationManager>,
  options: CoreChatOptions,
  lastMessage: Message = userMessage("hello"),
  finalMessage = "hello",
) {
  await storeUserTurn({
    options,
    conversationManager,
    lastMessage,
    finalMessage,
    primaryModel: "test-model",
    platform: "api",
    mode: "normal",
  });
}

describe("storeUserTurn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("appends the turn when the conversation is empty", async () => {
    const conversationManager = createConversationManager([]);

    await run(conversationManager, baseOptions());

    expect(conversationManager.addBatch).toHaveBeenCalledTimes(1);
    expect(conversationManager.replaceMessages).not.toHaveBeenCalled();

    const [, storedMessages] = conversationManager.addBatch.mock.calls[0];

    expect(storedMessages).toHaveLength(1);
    expect(storedMessages[0].content).toBe("hello");
  });

  it("stores attachments as a second message", async () => {
    const conversationManager = createConversationManager([]);
    const lastMessage = userMessage("", {
      content: [
        { type: "text", text: "look at this" },
        { type: "image_url", image_url: { url: "https://example.com/a.png" } },
      ],
    } as Partial<Message>);

    await run(conversationManager, baseOptions(), lastMessage, "look at this");

    const [, storedMessages] = conversationManager.addBatch.mock.calls[0];

    expect(storedMessages).toHaveLength(2);
    expect(storedMessages[1].content).toBe("Attachments");
    expect(storedMessages[1].data.attachments).toHaveLength(1);
  });

  it("replaces stored history when the client sends a shorter uncompacted list", async () => {
    const stored = [userMessage("one"), userMessage("two"), userMessage("three")];
    const incoming = [userMessage("one")];
    const conversationManager = createConversationManager(stored);

    await run(conversationManager, baseOptions({ messages: incoming }));

    expect(conversationManager.replaceMessages).toHaveBeenCalledWith("conv-1", incoming);
    expect(conversationManager.addBatch).not.toHaveBeenCalled();
  });

  it("preserves a goal marker omitted from model context when appending the next turn", async () => {
    const marker = goalMarkerMessage();
    const conversationManager = createConversationManager([marker]);
    const incoming = [userMessage("hello", { id: "user-1", timestamp: 20 })];

    await run(conversationManager, baseOptions({ messages: incoming }), incoming[0]);

    expect(conversationManager.replaceMessages).not.toHaveBeenCalled();
    expect(conversationManager.addBatch).toHaveBeenCalledTimes(1);
  });

  it("retains stored goal markers when divergent client history must replace messages", async () => {
    const marker = goalMarkerMessage(20);
    const stored = [
      userMessage("one", { id: "m1", timestamp: 10 }),
      marker,
      userMessage("two", { id: "m2", timestamp: 30 }),
    ];
    const incoming = [userMessage("edited", { id: "m1", timestamp: 10 })];
    const conversationManager = createConversationManager(stored);

    await run(conversationManager, baseOptions({ messages: incoming }));

    expect(conversationManager.replaceMessages).toHaveBeenCalledWith("conv-1", [
      incoming[0],
      marker,
    ]);
  });

  it("refuses to replace compacted history from a snapshot-unaware client", async () => {
    const stored = [snapshotMessage("summary so far"), userMessage("recent")];
    const incoming = [userMessage("one")];
    const conversationManager = createConversationManager(stored);

    await run(conversationManager, baseOptions({ messages: incoming }));

    expect(conversationManager.replaceMessages).not.toHaveBeenCalled();
    expect(conversationManager.addBatch).toHaveBeenCalledTimes(1);
  });

  it("allows replacement of compacted history when the client is snapshot-aware", async () => {
    const stored = [snapshotMessage("summary so far"), userMessage("a"), userMessage("b")];
    const incoming = [snapshotMessage("summary so far")];
    const conversationManager = createConversationManager(stored);

    await run(conversationManager, baseOptions({ messages: incoming }));

    expect(conversationManager.replaceMessages).toHaveBeenCalledWith("conv-1", incoming);
  });

  it("skips the write when the turn already sits at the tail of compacted history", async () => {
    const stored = [snapshotMessage("summary"), userMessage("hello")];
    const conversationManager = createConversationManager(stored);

    await run(conversationManager, baseOptions({ messages: [] }));

    expect(conversationManager.addBatch).not.toHaveBeenCalled();
    expect(conversationManager.replaceMessages).not.toHaveBeenCalled();
  });

  it("skips the write when an equal-length client list already matches storage", async () => {
    const stored = [userMessage("one", { id: "m1" })];
    const incoming = [userMessage("one", { id: "m1" })];
    const conversationManager = createConversationManager(stored);

    await run(conversationManager, baseOptions({ messages: incoming }));

    expect(conversationManager.replaceMessages).not.toHaveBeenCalled();
    expect(conversationManager.addBatch).not.toHaveBeenCalled();
  });

  it("replaces when an equal-length client list diverges from storage", async () => {
    const stored = [userMessage("one", { id: "m1" })];
    const incoming = [userMessage("edited", { id: "m1" })];
    const conversationManager = createConversationManager(stored);

    await run(conversationManager, baseOptions({ messages: incoming }));

    expect(conversationManager.replaceMessages).toHaveBeenCalledWith("conv-1", incoming);
  });

  it("still stores the turn when the conversation cannot be read", async () => {
    const conversationManager = createConversationManager(null);

    conversationManager.get.mockRejectedValue(new Error("d1 unavailable"));

    await run(conversationManager, baseOptions());

    expect(conversationManager.addBatch).toHaveBeenCalledTimes(1);
  });
});
