import { afterEach, describe, expect, it, vi } from "vitest";

import { clearWorkspaceInvitationToken, consumeWorkspaceInvitationToken } from "./invitation-token";

describe("workspace invitation token handling", () => {
  afterEach(() => {
    clearWorkspaceInvitationToken();
    vi.restoreAllMocks();
  });

  it("moves a query token into tab storage and removes it from browser history", () => {
    window.history.replaceState({}, "", "/work/invitations?token=secret&source=email");
    const replaceState = vi.spyOn(window.history, "replaceState");

    expect(consumeWorkspaceInvitationToken("secret")).toBe("secret");
    expect(replaceState).toHaveBeenLastCalledWith(
      window.history.state,
      "",
      "/work/invitations?source=email",
    );
    expect(window.location.search).not.toContain("secret");
  });

  it("restores the tab token after an authentication redirect", () => {
    consumeWorkspaceInvitationToken("secret");
    expect(consumeWorkspaceInvitationToken(null)).toBe("secret");
  });
});
