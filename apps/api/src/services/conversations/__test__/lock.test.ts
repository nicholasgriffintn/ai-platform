import type { CreateConversationLockInput, SealedEnvelope } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertConversationNotLocked,
  createConversationLock,
  getConversationLock,
  listLockedMessages,
} from "../lock";

const ENVELOPE: SealedEnvelope = {
  v: 1,
  iv: "aXYtdmFsdWU",
  ct: "Y2lwaGVydGV4dA",
};

function buildInput(): CreateConversationLockInput {
  return {
    version: 1,
    title: null,
    keys: [
      {
        type: "password",
        credential_id: null,
        label: null,
        salt: "c2FsdA",
        kdf: "pbkdf2-sha256",
        kdf_iterations: 600_000,
        wrapped_key: ENVELOPE,
      },
      {
        type: "recovery",
        credential_id: null,
        label: null,
        salt: "c2FsdDI",
        kdf: null,
        kdf_iterations: null,
        wrapped_key: ENVELOPE,
      },
    ],
    messages: [{ id: "msg_1", seq: 0, role: "user", envelope: ENVELOPE }],
  };
}

function buildContext(overrides: {
  conversation?: Record<string, unknown> | null;
  planId?: string | null;
  isLocked?: boolean;
}) {
  const batch = vi.fn().mockResolvedValue([]);
  const all = vi.fn().mockResolvedValue({ results: [] });
  const database = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({ all, run: vi.fn() }),
    }),
    batch,
  };

  const conversationLocks = {
    isLocked: vi.fn().mockResolvedValue(overrides.isLocked ?? false),
    createLock: vi.fn().mockResolvedValue(undefined),
    getLock: vi.fn().mockResolvedValue({
      conversation_id: "chat_1",
      version: 1,
      title: null,
      keys: [],
      created_at: "2026-01-01T00:00:00Z",
      updated_at: null,
    }),
    listMessages: vi.fn().mockResolvedValue([]),
  };

  const user = { id: 7, plan_id: overrides.planId ?? "pro" };

  return {
    context: {
      env: {},
      user,
      database,
      ensureDatabase: () => database,
      requireUser: () => user,
      repositories: {
        conversations: {
          getConversation: vi.fn().mockResolvedValue(
            overrides.conversation === undefined
              ? {
                  id: "chat_1",
                  user_id: 7,
                  project_id: null,
                  share_id: null,
                  is_public: 0,
                }
              : overrides.conversation,
          ),
        },
        conversationLocks,
      },
    } as never,
    conversationLocks,
    batch,
  };
}

describe("conversation lock service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("locks a conversation and destroys the plaintext the server holds", async () => {
    const { context, conversationLocks, batch } = buildContext({});

    await createConversationLock(context, "chat_1", buildInput());

    expect(conversationLocks.createLock).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: "chat_1", version: 1 }),
    );

    const purgedStatements = batch.mock.calls.at(-1)?.[0] ?? [];

    expect(purgedStatements.length).toBeGreaterThan(0);
  });

  it("refuses to lock without a recovery key", async () => {
    const { context } = buildContext({});
    const input = buildInput();

    input.keys = input.keys.filter((key) => key.type !== "recovery");

    await expect(createConversationLock(context, "chat_1", input)).rejects.toThrow(
      "needs a recovery key",
    );
  });

  it("refuses to lock a shared conversation", async () => {
    const { context } = buildContext({
      conversation: {
        id: "chat_1",
        user_id: 7,
        project_id: null,
        share_id: "abc",
        is_public: 1,
      },
    });

    await expect(createConversationLock(context, "chat_1", buildInput())).rejects.toThrow(
      "Stop sharing",
    );
  });

  it("refuses to lock a project conversation", async () => {
    const { context } = buildContext({
      conversation: {
        id: "chat_1",
        user_id: 7,
        project_id: "proj_1",
        share_id: null,
      },
    });

    await expect(createConversationLock(context, "chat_1", buildInput())).rejects.toThrow(
      "Project conversations cannot be locked",
    );
  });

  it("refuses to lock on a free plan", async () => {
    const { context } = buildContext({ planId: "free" });

    await expect(createConversationLock(context, "chat_1", buildInput())).rejects.toThrow(
      "available on Pro",
    );
  });

  it("hides a conversation owned by someone else", async () => {
    const { context } = buildContext({
      conversation: { id: "chat_1", user_id: 99, project_id: null },
    });

    await expect(getConversationLock(context, "chat_1")).rejects.toThrow("Conversation not found");
    await expect(listLockedMessages(context, "chat_1")).rejects.toThrow("Conversation not found");
  });

  it("refuses plaintext writes while a conversation is locked", async () => {
    const { context } = buildContext({ isLocked: true });

    await expect(assertConversationNotLocked(context, "chat_1", "Sharing")).rejects.toThrow(
      "Sharing is not available for locked conversations",
    );
  });
});
