import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv, Message } from "~/types";

import { SessionManager, type SessionConversationStore } from "../SessionManager";

const mockGetAuxiliaryModel = vi.fn();
const mockGetChatProvider = vi.fn();
const mockProviderGetResponse = vi.fn();

vi.mock("~/lib/providers/models", () => ({
  getAuxiliaryModel: (...args: unknown[]) => mockGetAuxiliaryModel(...args),
}));

vi.mock("~/lib/providers/capabilities/chat", () => ({
  getChatProvider: (...args: unknown[]) => mockGetChatProvider(...args),
}));

vi.mock("~/utils/id", () => ({
  generateId: () => "snapshot-message-id",
}));

function createLongMessage(index: number): Message {
  return {
    id: `msg-${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    content: `${"x".repeat(900)}-${index}`,
  };
}

function createShortMessage(index: number): Message {
  return {
    id: `msg-${index}`,
    role: index % 2 === 0 ? "user" : "assistant",
    content: `short message ${index}`,
  };
}

function createTimestampedShortMessage(index: number): Message {
  return {
    ...createShortMessage(index),
    timestamp: 10_000 + index,
  };
}

describe("SessionManager", () => {
  const mockConversationManager: SessionConversationStore = {
    persistCompaction: vi.fn(),
  };

  const env = {
    AI: {},
  } as IEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuxiliaryModel.mockResolvedValue({
      model: "aux-model",
      provider: "test-provider",
    });
    mockProviderGetResponse.mockResolvedValue({
      response: "Summarised archived messages",
    });
    mockGetChatProvider.mockReturnValue({
      getResponse: mockProviderGetResponse,
    });
  });

  it("returns original messages when compaction is not needed", async () => {
    const manager = new SessionManager({
      env,
      conversationManager: mockConversationManager,
    });

    const messages = Array.from({ length: 8 }, (_, index): Message => ({
      id: `msg-${index}`,
      role: "user",
      content: "short",
    }));

    const result = await manager.compact({
      completionId: "conv-1",
      messages,
      modelConfig: { contextWindow: 8192 },
    });

    expect(result.compacted).toBe(false);
    expect(result.messages).toEqual(messages);
    expect(mockConversationManager.persistCompaction).not.toHaveBeenCalled();
  });

  it("compacts and persists snapshot + archived IDs", async () => {
    const manager = new SessionManager({
      env,
      conversationManager: mockConversationManager,
    });

    const messages = Array.from({ length: 30 }, (_, index) => createLongMessage(index));

    const result = await manager.compact({
      completionId: "conv-2",
      messages,
      mode: "build",
      modelConfig: { contextWindow: 4096 },
    });

    expect(result.snapshotMessage?.id).toBe("snapshot-message-id");
    expect(mockConversationManager.persistCompaction).toHaveBeenCalledWith(
      "conv-2",
      expect.objectContaining({
        id: "snapshot-message-id",
        parts: expect.arrayContaining([expect.objectContaining({ type: "snapshot" })]),
      }),
      expect.objectContaining({
        id: "snapshot-message-id-compaction",
        completion_id: "conv-2",
        role: "compaction",
        content: "Context automatically compacted",
        parts: expect.arrayContaining([
          expect.objectContaining({
            type: "compaction",
            status: "completed",
          }),
        ]),
      }),
      expect.arrayContaining(["msg-0", "msg-1", "snapshot-message-id-compaction"]),
    );
  });

  it("persists and archives exactly the messages represented within the summary input cap", async () => {
    const manager = new SessionManager({
      env,
      conversationManager: mockConversationManager,
    });

    const messages = Array.from({ length: 30 }, (_, index) =>
      index === 20
        ? {
            ...createLongMessage(index),
            content: "Constraint: retain audit records for seven years.",
          }
        : createLongMessage(index),
    );

    const result = await manager.compact({
      completionId: "conv-covered",
      messages,
      modelConfig: { contextWindow: 4096 },
    });

    const snapshotPart = result.snapshotMessage?.parts?.find((part) => part.type === "snapshot");
    const coverage = snapshotPart?.type === "snapshot" ? snapshotPart.coverage : undefined;
    const persistenceCall = vi.mocked(mockConversationManager.persistCompaction).mock.calls[0];
    const archivedIds = persistenceCall?.[3].filter(
      (messageId) => messageId !== "snapshot-message-id-compaction",
    );
    const summaryRequest = mockProviderGetResponse.mock.calls[0]?.[0];

    expect(coverage?.coveredMessageIds).toEqual(archivedIds);
    expect(coverage?.coveredMessageCount).toBe(archivedIds?.length);
    expect(coverage?.candidateMessageCount).toBe(22);
    expect(coverage?.summaryInputCharacters).toBeLessThanOrEqual(16000);
    expect(coverage?.strategy).toBe("model_summary");
    expect(result.messages).toContain(messages[20]);
    expect(summaryRequest.messages[1].content).not.toContain("retain audit records");
  });

  it("does not compact when the first candidate message cannot be represented in full", async () => {
    const manager = new SessionManager({
      env,
      conversationManager: mockConversationManager,
    });
    const messages: Message[] = [
      {
        id: "oversized",
        role: "user",
        content: "x".repeat(17000),
      },
      {
        id: "later",
        role: "assistant",
        content: "Later response",
      },
    ];

    const result = await manager.compact({
      completionId: "conv-oversized",
      messages,
      compaction: "manual",
    });

    expect(result).toEqual({ messages, compacted: false });
    expect(mockProviderGetResponse).not.toHaveBeenCalled();
    expect(mockConversationManager.persistCompaction).not.toHaveBeenCalled();
  });

  it("rejects when compacted history cannot be persisted", async () => {
    const manager = new SessionManager({
      env,
      conversationManager: mockConversationManager,
    });

    vi.mocked(mockConversationManager.persistCompaction).mockRejectedValueOnce(
      new Error("persistence failed"),
    );

    const messages = Array.from({ length: 30 }, (_, index) => createLongMessage(index));

    await expect(
      manager.compact({
        completionId: "conv-persist-fails",
        messages,
        modelConfig: { contextWindow: 4096 },
      }),
    ).rejects.toThrow("persistence failed");
    expect(mockConversationManager.persistCompaction).toHaveBeenCalledTimes(1);
  });

  it("manually compacts conversations below the automatic token threshold", async () => {
    const manager = new SessionManager({
      env,
      conversationManager: mockConversationManager,
    });

    const messages = Array.from({ length: 30 }, (_, index) => createShortMessage(index));

    const result = await manager.compact({
      completionId: "conv-manual",
      messages,
      compaction: "manual",
      modelConfig: { contextWindow: 128000 },
    });

    expect(result.compacted).toBe(true);
    expect(result.snapshotMessage?.parts).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "snapshot" })]),
    );
    expect(mockConversationManager.persistCompaction).toHaveBeenCalledWith(
      "conv-manual",
      expect.any(Object),
      expect.any(Object),
      expect.arrayContaining(["msg-0", "msg-1"]),
    );
  });

  it("manually compacts short conversations", async () => {
    const manager = new SessionManager({
      env,
      conversationManager: mockConversationManager,
    });

    const messages = Array.from({ length: 6 }, (_, index) => createTimestampedShortMessage(index));

    const result = await manager.compact({
      completionId: "conv-short-manual",
      messages,
      compaction: "manual",
      modelConfig: { contextWindow: 128000 },
    });

    expect(result.compacted).toBe(true);
    expect(result.snapshotMessage?.parts).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "snapshot" })]),
    );
    expect(result.messages).toEqual([result.snapshotMessage]);
    expect(mockConversationManager.persistCompaction).toHaveBeenCalledWith(
      "conv-short-manual",
      expect.any(Object),
      expect.any(Object),
      expect.arrayContaining([
        "msg-0",
        "msg-1",
        "msg-2",
        "msg-3",
        "msg-4",
        "msg-5",
        "snapshot-message-id-compaction",
      ]),
    );
  });

  it("archives previous snapshots when compacting active history again", async () => {
    const manager = new SessionManager({
      env,
      conversationManager: mockConversationManager,
    });

    const messages = [
      {
        id: "previous-snapshot",
        role: "assistant",
        content: "Conversation snapshot\n\nEarlier context.",
        parts: [{ type: "snapshot", summary: "Earlier context." }],
      },
      ...Array.from({ length: 12 }, (_, index): Message => ({
        id: `msg-${index}`,
        role: index % 2 === 0 ? "user" : "assistant",
        content: `message ${index}`,
      })),
    ] satisfies Message[];

    const result = await manager.compact({
      completionId: "conv-recompact",
      messages,
      compaction: "manual",
      modelConfig: { contextWindow: 128000 },
    });

    expect(result.compacted).toBe(true);
    expect(mockConversationManager.persistCompaction).toHaveBeenCalledWith(
      "conv-recompact",
      expect.any(Object),
      expect.any(Object),
      expect.arrayContaining(["previous-snapshot", "msg-0", "snapshot-message-id-compaction"]),
    );
    expect(result.messages).toEqual([result.snapshotMessage]);
  });

  it("timestamps snapshots before the retained recent tail", async () => {
    const manager = new SessionManager({
      env,
      conversationManager: mockConversationManager,
    });

    const messages = Array.from({ length: 30 }, (_, index): Message => ({
      id: `msg-${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      content: `${"x".repeat(900)}-${index}`,
      timestamp: 10_000 + index,
    }));

    const result = await manager.compact({
      completionId: "conv-order",
      messages,
      modelConfig: { contextWindow: 4096 },
    });

    const snapshotPart = result.snapshotMessage?.parts?.find((part) => part.type === "snapshot");
    const coverage = snapshotPart?.type === "snapshot" ? snapshotPart.coverage : undefined;
    const firstRetainedMessage = messages[coverage?.coveredMessageCount ?? 0];

    expect(result.snapshotMessage?.timestamp).toBe(firstRetainedMessage.timestamp - 1);
  });

  it("does not compact when compaction is disabled for the request", async () => {
    const manager = new SessionManager({
      env,
      conversationManager: mockConversationManager,
    });

    const messages = Array.from({ length: 30 }, (_, index) => createLongMessage(index));

    const result = await manager.compact({
      completionId: "conv-off",
      messages,
      compaction: "off",
      modelConfig: { contextWindow: 4096 },
    });

    expect(result.compacted).toBe(false);
    expect(result.messages).toEqual(messages);
    expect(mockConversationManager.persistCompaction).not.toHaveBeenCalled();
  });

  it("falls back when summarisation fails", async () => {
    const manager = new SessionManager({
      env,
      conversationManager: mockConversationManager,
    });

    mockProviderGetResponse.mockRejectedValueOnce(new Error("provider failure"));

    const summary = await manager.summarise([
      {
        id: "m-1",
        role: "user",
        content: "User asked for a migration strategy.",
      },
      {
        id: "m-2",
        role: "assistant",
        content: "Assistant suggested a phased migration.",
      },
    ]);

    expect(summary).toContain("Earlier context transcript");
  });

  it("marks fallback coverage and preserves every archived message verbatim", async () => {
    const manager = new SessionManager({
      env,
      conversationManager: mockConversationManager,
    });

    mockProviderGetResponse.mockRejectedValueOnce(new Error("provider failure"));
    const messages = Array.from({ length: 8 }, (_, index) => createShortMessage(index));

    const result = await manager.compact({
      completionId: "conv-fallback",
      messages,
      compaction: "manual",
    });

    const snapshotPart = result.snapshotMessage?.parts?.find((part) => part.type === "snapshot");
    const coverage = snapshotPart?.type === "snapshot" ? snapshotPart.coverage : undefined;

    expect(coverage).toMatchObject({
      coveredMessageIds: messages.map((message) => message.id),
      coveredMessageCount: messages.length,
      candidateMessageCount: messages.length,
      strategy: "fallback_transcript",
    });
    expect(snapshotPart?.summary).toContain("short message 0");
    expect(snapshotPart?.summary).toContain("short message 7");
  });
});
