import { describe, expect, it, vi } from "vitest";

import { ConversationManager } from "../conversationManager";

function createManager(assertOwned: () => Promise<void>) {
  const createCompactionAndArchiveMessages = vi.fn().mockResolvedValue(undefined);
  const database = {
    repositories: {
      conversations: {
        getConversation: vi.fn().mockResolvedValue({
          id: "conversation-1",
          user_id: 123,
          project_id: null,
        }),
      },
      messages: {
        createCompactionAndArchiveMessages,
      },
    },
  } as any;
  const manager = ConversationManager.getInstance({
    database,
    user: { id: 123 } as any,
    writeFence: { assertOwned },
  });

  return { createCompactionAndArchiveMessages, manager };
}

describe("ConversationManager write fence", () => {
  it("commits owner-protected compaction while the lease is current", async () => {
    const assertOwned = vi.fn().mockResolvedValue(undefined);
    const { createCompactionAndArchiveMessages, manager } = createManager(assertOwned);

    await manager.persistCompaction(
      "conversation-1",
      { id: "snapshot-1", role: "assistant", content: "Snapshot" },
      { id: "marker-1", role: "compaction", content: "Compacted" },
      ["message-1", "marker-1"],
    );

    expect(assertOwned).toHaveBeenCalled();
    expect(createCompactionAndArchiveMessages).toHaveBeenCalledTimes(1);
  });

  it("does not reach persistence after the owner is fenced", async () => {
    const assertOwned = vi.fn().mockRejectedValue(new Error("lease lost"));
    const { createCompactionAndArchiveMessages, manager } = createManager(assertOwned);

    await expect(
      manager.persistCompaction(
        "conversation-1",
        { id: "snapshot-1", role: "assistant", content: "Snapshot" },
        { id: "marker-1", role: "compaction", content: "Compacted" },
        ["message-1", "marker-1"],
      ),
    ).rejects.toThrow("lease lost");
    expect(createCompactionAndArchiveMessages).not.toHaveBeenCalled();
  });
});
