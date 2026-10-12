import { describe, expect, it, vi } from "vitest";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";

import {
  getPublicConversation,
  shareConversation,
  unshareConversation,
  type ConversationSharingScope,
} from "../sharing";

function createRepositories(conversation: Record<string, unknown>) {
  const updateConversation = vi.fn(async (_id: string, updates: Record<string, unknown>) => {
    Object.assign(conversation, updates);

    return { success: true };
  });
  const rows = [
    { id: "m1", role: "user", content: "Before", timestamp: 1_000 },
    { id: "m2", role: "assistant", content: "Reply", timestamp: 2_000 },
    { id: "m3", role: "user", content: "Private follow-up", timestamp: 3_000 },
  ];

  return {
    updateConversation,
    repositories: {
      conversations: {
        getConversation: vi.fn(async () => conversation),
        getConversationByShareId: vi.fn(async (shareId: string) =>
          conversation.share_id === shareId ? conversation : null,
        ),
        updateConversation,
      },
      messages: {
        getMessages: vi.fn(async (_id: string, _limit: number, after?: string) =>
          after ? [] : rows,
        ),
      },
    } as unknown as RepositoryManager,
  };
}

function createScope(repositories: RepositoryManager): ConversationSharingScope {
  return {
    repositories,
    user: { id: 7 } as ConversationSharingScope["user"],
    canAccessConversation: async () => true,
    assertWriteOwnership: async () => undefined,
  };
}

describe("conversation sharing", () => {
  it("shows readers only what existed when the link was last shared", async () => {
    const conversation: Record<string, unknown> = { id: "c1", user_id: 7, project_id: null };
    const { repositories } = createRepositories(conversation);

    const share = await shareConversation(createScope(repositories), "c1", 2_500);
    const page = await getPublicConversation(repositories, share.share_id, 50);

    expect(page.sharedThrough).toBe(2_500);
    expect(page.messages.map((message) => message.id)).toEqual(["m1", "m2"]);

    await shareConversation(createScope(repositories), "c1", 3_500);
    const updated = await getPublicConversation(repositories, share.share_id, 50);

    expect(updated.messages.map((message) => message.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("retires the link when sharing stops so a later share gets a new one", async () => {
    const conversation: Record<string, unknown> = { id: "c1", user_id: 7, project_id: null };
    const { repositories } = createRepositories(conversation);
    const scope = createScope(repositories);

    const first = await shareConversation(scope, "c1", 2_500);

    await unshareConversation(scope, "c1");

    await expect(getPublicConversation(repositories, first.share_id, 50)).rejects.toThrow(
      "Shared conversation not found",
    );

    const second = await shareConversation(scope, "c1", 3_500);

    expect(second.share_id).not.toBe(first.share_id);
  });
});
