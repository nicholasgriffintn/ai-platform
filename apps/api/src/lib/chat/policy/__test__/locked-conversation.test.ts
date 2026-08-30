import { describe, expect, it, vi } from "vitest";

import { assertLockedTurnIsPermitted } from "../locked-conversation";

const PRO_USER = { id: 7, plan_id: "pro" } as never;

function buildContext(overrides: { conversation?: unknown; isLocked?: boolean } = {}) {
  return {
    repositories: {
      conversations: {
        getConversation: vi
          .fn()
          .mockResolvedValue(
            overrides.conversation === undefined
              ? { id: "chat_1", user_id: 7 }
              : overrides.conversation,
          ),
      },
      conversationLocks: {
        isLocked: vi.fn().mockResolvedValue(overrides.isLocked ?? true),
      },
    },
  } as never;
}

const BASE_REQUEST = { store: false as const };

describe("locked turn policy", () => {
  it("allows a locked turn that asks for nothing forbidden", async () => {
    await expect(
      assertLockedTurnIsPermitted({
        request: BASE_REQUEST,
        completionId: "chat_1",
        context: buildContext(),
        user: PRO_USER,
      }),
    ).resolves.toBeUndefined();
  });

  it.each([
    ["stored", { store: true }, "cannot be stored"],
    ["tools", { ...BASE_REQUEST, enabled_tools: ["web_search"] }, "cannot use tools"],
    ["retrieval", { ...BASE_REQUEST, use_rag: true }, "cannot use retrieval"],
    [
      "multiple models",
      { ...BASE_REQUEST, use_multi_model: true, models: ["a", "b"] },
      "cannot use multiple models",
    ],
    ["background mode", { ...BASE_REQUEST, background: true }, "background mode"],
    ["compaction", { ...BASE_REQUEST, compaction: "auto" }, "cannot be compacted"],
    ["agents", { ...BASE_REQUEST, options: { agent: { id: "a" } } }, "cannot use agents"],
    ["the sandbox", { ...BASE_REQUEST, options: { sandbox: { enabled: true } } }, "sandbox"],
  ])("refuses a locked turn that asks for %s", async (_label, request, message) => {
    await expect(
      assertLockedTurnIsPermitted({
        request: request as never,
        completionId: "chat_1",
        context: buildContext(),
        user: PRO_USER,
      }),
    ).rejects.toThrow(message);
  });

  it("refuses a locked turn from a free user", async () => {
    await expect(
      assertLockedTurnIsPermitted({
        request: BASE_REQUEST,
        completionId: "chat_1",
        context: buildContext(),
        user: { id: 7, plan_id: "free" } as never,
      }),
    ).rejects.toThrow("available on Pro");
  });

  it("refuses a locked turn for someone else's conversation", async () => {
    await expect(
      assertLockedTurnIsPermitted({
        request: BASE_REQUEST,
        completionId: "chat_1",
        context: buildContext({ conversation: { id: "chat_1", user_id: 99 } }),
        user: PRO_USER,
      }),
    ).rejects.toThrow("Conversation not found");
  });

  it("refuses a locked turn on a conversation that is not actually locked", async () => {
    await expect(
      assertLockedTurnIsPermitted({
        request: BASE_REQUEST,
        completionId: "chat_1",
        context: buildContext({ isLocked: false }),
        user: PRO_USER,
      }),
    ).rejects.toThrow("not locked");
  });
});
