// @vitest-environment node
import type { ConversationLock, ConversationLockKeyInput } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  ConversationLockKeyError,
  createAdditionalLockKey,
  createLockMaterial,
  openMessage,
  openTitle,
  sealMessage,
  sealTitle,
  unlockConversation,
} from "..";

const CONVERSATION_ID = "chat_locked_1";
const PASSWORD = "correct horse battery staple";

function toLock(
  keys: ConversationLockKeyInput[],
  conversationId = CONVERSATION_ID,
): ConversationLock {
  return {
    conversation_id: conversationId,
    version: 1,
    title: null,
    keys: keys.map((key, index) => ({
      ...key,
      id: `key_${index}`,
      created_at: "2026-01-01T00:00:00Z",
      last_used_at: null,
    })),
    created_at: "2026-01-01T00:00:00Z",
    updated_at: null,
  };
}

async function createPasswordLock(conversationId = CONVERSATION_ID) {
  const material = await createLockMaterial(conversationId, {
    type: "password",
    password: PASSWORD,
  });

  return { material, lock: toLock(material.keys, conversationId) };
}

describe("conversation lock", () => {
  it("opens a locked conversation with the password that sealed it", async () => {
    const { lock } = await createPasswordLock();

    const result = await unlockConversation(lock, {
      type: "password",
      password: PASSWORD,
    });

    expect(result.material).toHaveLength(32);
  });

  it("refuses a password that did not seal the conversation", async () => {
    const { lock } = await createPasswordLock();

    await expect(
      unlockConversation(lock, {
        type: "password",
        password: "not the password",
      }),
    ).rejects.toBeInstanceOf(ConversationLockKeyError);
  });

  it("opens the conversation with the recovery key when the password is lost", async () => {
    const { lock, material } = await createPasswordLock();

    const result = await unlockConversation(lock, {
      type: "recovery",
      recoveryKey: material.recoveryKey,
    });

    expect(result.material).toEqual(material.material);
  });

  it("refuses a recovery key from a different conversation", async () => {
    const { lock } = await createPasswordLock();
    const other = await createPasswordLock("chat_locked_2");

    await expect(
      unlockConversation(lock, {
        type: "recovery",
        recoveryKey: other.material.recoveryKey,
      }),
    ).rejects.toBeInstanceOf(ConversationLockKeyError);
  });

  it("round-trips a message and its title", async () => {
    const { material } = await createPasswordLock();
    const sealed = await sealMessage({
      conversationId: CONVERSATION_ID,
      conversationKey: material.conversationKey,
      id: "msg_1",
      seq: 0,
      role: "user",
      payload: { content: "the quiet part", model: "gpt-5" },
    });

    const opened = await openMessage({
      conversationId: CONVERSATION_ID,
      conversationKey: material.conversationKey,
      message: { ...sealed, created_at: "2026-01-01T00:00:00Z" },
    });

    expect(opened.content).toBe("the quiet part");

    const titleEnvelope = await sealTitle(
      CONVERSATION_ID,
      material.conversationKey,
      "Something private",
    );

    await expect(openTitle(CONVERSATION_ID, material.conversationKey, titleEnvelope)).resolves.toBe(
      "Something private",
    );
  });

  it("refuses an envelope moved to another position in the thread", async () => {
    const { material } = await createPasswordLock();
    const sealed = await sealMessage({
      conversationId: CONVERSATION_ID,
      conversationKey: material.conversationKey,
      id: "msg_1",
      seq: 0,
      role: "user",
      payload: { content: "the quiet part" },
    });

    await expect(
      openMessage({
        conversationId: CONVERSATION_ID,
        conversationKey: material.conversationKey,
        message: { ...sealed, seq: 4, created_at: "2026-01-01T00:00:00Z" },
      }),
    ).rejects.toThrow();
  });

  it("refuses an envelope moved to another conversation", async () => {
    const { material } = await createPasswordLock();
    const sealed = await sealMessage({
      conversationId: CONVERSATION_ID,
      conversationKey: material.conversationKey,
      id: "msg_1",
      seq: 0,
      role: "user",
      payload: { content: "the quiet part" },
    });

    await expect(
      openMessage({
        conversationId: "chat_locked_2",
        conversationKey: material.conversationKey,
        message: { ...sealed, created_at: "2026-01-01T00:00:00Z" },
      }),
    ).rejects.toThrow();
  });

  it("refuses tampered ciphertext", async () => {
    const { material } = await createPasswordLock();
    const sealed = await sealMessage({
      conversationId: CONVERSATION_ID,
      conversationKey: material.conversationKey,
      id: "msg_1",
      seq: 0,
      role: "user",
      payload: { content: "the quiet part" },
    });
    const tampered = {
      ...sealed,
      envelope: {
        ...sealed.envelope,
        ct: `${sealed.envelope.ct.slice(0, -2)}AA`,
      },
      created_at: "2026-01-01T00:00:00Z",
    };

    await expect(
      openMessage({
        conversationId: CONVERSATION_ID,
        conversationKey: material.conversationKey,
        message: tampered,
      }),
    ).rejects.toThrow();
  });

  it("lets a second password open a conversation without resealing it", async () => {
    const { lock, material } = await createPasswordLock();
    const added = await createAdditionalLockKey({
      conversationId: CONVERSATION_ID,
      conversationKeyMaterial: material.material,
      method: { type: "password", password: "a second way in entirely" },
    });
    const extendedLock = toLock([...material.keys, added]);

    const result = await unlockConversation(extendedLock, {
      type: "password",
      password: "a second way in entirely",
    });

    expect(result.material).toEqual(material.material);
    expect(lock.keys).toHaveLength(2);
  });
});
