import { CONVERSATION_LOCK_CONTEXT_TOKEN_CAP } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { resolveConversationStorageMode } from "./conversation-storage-policy";
import { measureLockedContext } from "./locked-conversation-cap";

const PRO_STATE = {
  chatMode: "remote" as const,
  isAuthenticated: true,
  isPro: true,
  localOnlyMode: false,
  settingsLocalOnly: false,
};

describe("locked conversation storage policy", () => {
  it("keeps plaintext off the server and off the device", () => {
    const mode = resolveConversationStorageMode({
      ...PRO_STATE,
      isLocked: true,
    });

    expect(mode).toMatchObject({
      isLocked: true,
      shouldPersistPlaintext: false,
      shouldSyncEnvelopes: true,
      shouldSyncRemote: false,
    });
  });

  it("does not sync envelopes for a signed-out user", () => {
    const mode = resolveConversationStorageMode({
      ...PRO_STATE,
      isAuthenticated: false,
      isLocked: true,
    });

    expect(mode.shouldSyncEnvelopes).toBe(false);
  });

  it("leaves an unlocked conversation on its usual path", () => {
    const mode = resolveConversationStorageMode(PRO_STATE);

    expect(mode).toMatchObject({
      isLocked: false,
      shouldPersistPlaintext: true,
      shouldSyncRemote: true,
    });
  });

  it("ignores project scope for a locked conversation", () => {
    const mode = resolveConversationStorageMode(
      { ...PRO_STATE, isLocked: true },
      { metadata: { project_id: "proj_1" } },
    );

    expect(mode.isProjectScoped).toBe(false);
  });
});

describe("locked conversation context cap", () => {
  it("stays under the cap for an ordinary thread", () => {
    const usage = measureLockedContext([{ content: "a short question" }]);

    expect(usage.isOverCap).toBe(false);
    expect(usage.remainingTokens).toBeGreaterThan(0);
  });

  it("reports a thread that has outgrown what a locked chat can carry", () => {
    const usage = measureLockedContext([
      { content: "x".repeat(CONVERSATION_LOCK_CONTEXT_TOKEN_CAP * 4) },
    ]);

    expect(usage.isOverCap).toBe(true);
    expect(usage.remainingTokens).toBe(0);
  });

  it("counts text inside structured message parts", () => {
    const usage = measureLockedContext([
      {
        content: [
          { type: "text", text: "one" },
          { type: "text", text: "two" },
        ],
      },
    ]);

    expect(usage.estimatedTokens).toBeGreaterThan(0);
  });
});
