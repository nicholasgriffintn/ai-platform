import { describe, expect, it } from "vitest";

import { resolveConversationStorageMode } from "./conversation-storage-policy.js";

const signedInPro = {
  isAuthenticated: true,
  isPro: true,
  temporaryChatsDefault: false,
};

describe("resolveConversationStorageMode", () => {
  it("syncs an ordinary conversation", () => {
    expect(resolveConversationStorageMode(signedInPro)).toEqual({
      retention: "kept",
      reason: "chosen",
      isProjectScoped: false,
    });
  });

  it("keeps a conversation the person marked temporary off the service", () => {
    expect(resolveConversationStorageMode({ ...signedInPro, temporaryChat: true })).toEqual({
      retention: "temporary",
      reason: "chosen",
      isProjectScoped: false,
    });
  });

  it("keeps every new conversation temporary when that is the person's setting", () => {
    expect(resolveConversationStorageMode({ ...signedInPro, temporaryChatsDefault: true })).toEqual(
      {
        retention: "temporary",
        reason: "default",
        isProjectScoped: false,
      },
    );
  });

  it("syncs project work regardless of the temporary setting, because it is shared", () => {
    const mode = resolveConversationStorageMode(
      { ...signedInPro, temporaryChat: true, temporaryChatsDefault: true },
      { metadata: { project_id: "project-1" } },
    );

    expect(mode).toEqual({
      retention: "kept",
      reason: "chosen",
      isProjectScoped: true,
    });
  });

  it("cannot sync without an account or the entitlement to store", () => {
    expect(resolveConversationStorageMode({ ...signedInPro, isAuthenticated: false })).toEqual({
      retention: "temporary",
      reason: "signed_out",
      isProjectScoped: false,
    });
    expect(resolveConversationStorageMode({ ...signedInPro, isPro: false })).toEqual({
      retention: "temporary",
      reason: "plan",
      isProjectScoped: false,
    });
  });

  it("keeps a conversation answered on this machine when the person has not chosen temporary", () => {
    const onDevice = { ...signedInPro, runsOnDevice: true };

    expect(resolveConversationStorageMode(onDevice)).toEqual({
      retention: "kept",
      reason: "device_default",
      isProjectScoped: false,
    });
    expect(resolveConversationStorageMode({ ...onDevice, temporaryChat: true })).toEqual({
      retention: "temporary",
      reason: "chosen",
      isProjectScoped: false,
    });
    expect(
      resolveConversationStorageMode(onDevice, { metadata: { project_id: "project-1" } }),
    ).toEqual({
      retention: "kept",
      reason: "chosen",
      isProjectScoped: true,
    });
  });
});
