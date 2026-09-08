import { describe, expect, it, vi } from "vitest";

import { ConversationManager } from "../conversationManager";

function createManager(parent: Record<string, unknown> | null) {
  const createConversation = vi.fn().mockResolvedValue({ id: "branch-1" });
  const getConversation = vi.fn().mockImplementation(async (id: string) => {
    if (id === "branch-1") {
      return null;
    }

    return parent;
  });
  const database = {
    repositories: {
      conversations: { getConversation, createConversation },
      messages: {
        createMessagesAndUpdateConversation: vi.fn().mockResolvedValue(undefined),
      },
      users: { updateUser: vi.fn().mockResolvedValue(undefined) },
    },
  } as any;
  const manager = ConversationManager.getInstance({
    database,
    user: { id: 123 } as any,
    store: true,
  });

  return { createConversation, manager };
}

const branchOptions = {
  metadata: { branch_of: JSON.stringify({ conversation_id: "parent-1", message_id: "message-1" }) },
};

describe("ConversationManager permission mode", () => {
  it("gives a branch the mode its parent runs under", async () => {
    const { createConversation, manager } = createManager({
      id: "parent-1",
      user_id: 123,
      permission_mode: "supervised",
    });

    await manager.addBatch("branch-1", [{ role: "user", content: "Continue" }], branchOptions);

    expect(createConversation).toHaveBeenCalledWith(
      "branch-1",
      123,
      expect.anything(),
      expect.objectContaining({
        parent_conversation_id: "parent-1",
        permission_mode: "supervised",
      }),
    );
  });

  it("keeps an explicit mode over the parent's", async () => {
    const { createConversation, manager } = createManager({
      id: "parent-1",
      user_id: 123,
      permission_mode: "supervised",
    });

    await manager.addBatch("branch-1", [{ role: "user", content: "Continue" }], {
      ...branchOptions,
      permission_mode: "full_access",
    });

    expect(createConversation).toHaveBeenCalledWith(
      "branch-1",
      123,
      expect.anything(),
      expect.objectContaining({ permission_mode: "full_access" }),
    );
  });

  it("leaves the column default in place when there is no parent", async () => {
    const { createConversation, manager } = createManager(null);

    await manager.addBatch("conversation-1", [{ role: "user", content: "Start" }]);

    expect(createConversation).toHaveBeenCalledWith(
      "conversation-1",
      123,
      expect.anything(),
      expect.objectContaining({ permission_mode: undefined }),
    );
  });
});
