import { describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ConversationManager } from "~/modules/conversations/application/manager";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";

function createManager(parent: Record<string, unknown> | null) {
  const createConversation = vi.fn().mockResolvedValue({ id: "branch-1" });
  const getConversation = vi.fn().mockImplementation(async (id: string) => {
    if (id === "branch-1") {
      return null;
    }

    return parent;
  });
  const repositories = fakeRepositories([
    [ConversationRepository, { getConversation, createConversation }],
    [
      MessageRepository,
      {
        createMessagesAndUpdateConversation: vi.fn().mockResolvedValue(undefined),
      },
    ],
    [UserRepository, { updateUser: vi.fn().mockResolvedValue(undefined) }],
  ]);
  const manager = ConversationManager.getInstance({
    repositories,
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
});
