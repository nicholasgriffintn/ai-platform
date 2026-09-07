import { describe, expect, it } from "vitest";

import { resolveConversationStorageMode } from "./conversation-storage-policy.js";

const signedInPro = {
  isAuthenticated: true,
  isPro: true,
  temporaryChat: false,
  temporaryChatsDefault: false,
};

describe("resolveConversationStorageMode", () => {
  it("syncs an ordinary conversation", () => {
    expect(resolveConversationStorageMode(signedInPro)).toEqual({
      isTemporary: false,
      isProjectScoped: false,
      shouldSyncRemote: true,
    });
  });

  it("keeps a conversation the person marked temporary off the service", () => {
    expect(
      resolveConversationStorageMode({ ...signedInPro, temporaryChat: true }).shouldSyncRemote,
    ).toBe(false);
  });

  it("keeps every new conversation temporary when that is the person's setting", () => {
    expect(
      resolveConversationStorageMode({ ...signedInPro, temporaryChatsDefault: true }).isTemporary,
    ).toBe(true);
  });

  it("syncs project work regardless of the temporary setting, because it is shared", () => {
    const mode = resolveConversationStorageMode(
      { ...signedInPro, temporaryChat: true, temporaryChatsDefault: true },
      { metadata: { project_id: "project-1" } },
    );

    expect(mode).toEqual({ isTemporary: false, isProjectScoped: true, shouldSyncRemote: true });
  });

  it("cannot sync without an account or the entitlement to store", () => {
    expect(
      resolveConversationStorageMode({ ...signedInPro, isAuthenticated: false }).isTemporary,
    ).toBe(true);
    expect(resolveConversationStorageMode({ ...signedInPro, isPro: false }).isTemporary).toBe(true);
  });

  it("does not let where a model runs decide where the conversation is kept", () => {
    expect(resolveConversationStorageMode(signedInPro).shouldSyncRemote).toBe(true);
  });

  it("keeps a conversation answered on this machine off the service", () => {
    const onDevice = { ...signedInPro, runsOnDevice: true };

    expect(resolveConversationStorageMode(onDevice).isTemporary).toBe(true);
    expect(resolveConversationStorageMode(onDevice).shouldSyncRemote).toBe(false);
    expect(
      resolveConversationStorageMode(onDevice, { metadata: { project_id: "project-1" } })
        .shouldSyncRemote,
    ).toBe(false);
  });
});
