import { describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ConversationManager } from "~/modules/conversations/application/manager";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import type { Message } from "~/types";

function createManager(assertOwned: () => Promise<void>) {
  const createCompactionAndArchiveMessages = vi.fn().mockResolvedValue(undefined);
  const createMessagesAndUpdateConversation = vi.fn().mockResolvedValue(undefined);
  const updateConversation = vi.fn().mockResolvedValue(null);
  const repositories = fakeRepositories([
    [
      ConversationRepository,
      {
        getConversation: vi.fn().mockResolvedValue({
          id: "conversation-1",
          user_id: 123,
          project_id: null,
          model_id: "stored-model",
        }),
        updateConversation,
      },
    ],
    [
      MessageRepository,
      {
        createCompactionAndArchiveMessages,
        createMessagesAndUpdateConversation,
      },
    ],
  ]);
  const manager = ConversationManager.getInstance({
    repositories,
    user: { id: 123 } as any,
    writeFence: { assertOwned },
  });

  return {
    createCompactionAndArchiveMessages,
    createMessagesAndUpdateConversation,
    manager,
    updateConversation,
  };
}

const USER_TURN: Message[] = [{ id: "message-1", role: "user", content: "Hello" }];

describe("ConversationManager write fence", () => {
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

  it("refuses a user turn from a stale owner before writing it", async () => {
    const assertOwned = vi.fn().mockRejectedValue(new Error("lease lost"));
    const { createMessagesAndUpdateConversation, manager } = createManager(assertOwned);

    await expect(manager.addBatch("conversation-1", USER_TURN)).rejects.toThrow("lease lost");
    expect(createMessagesAndUpdateConversation).not.toHaveBeenCalled();
  });
});
