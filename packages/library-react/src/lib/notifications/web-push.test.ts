import { describe, expect, it, vi } from "vitest";

import { decodeWebPushPublicKey, notificationPermission } from "./web-push";

describe("web push lifecycle", () => {
  it("decodes a URL-safe application server key", () => {
    expect([...decodeWebPushPublicKey("AQID-_8")]).toEqual([1, 2, 3, 251, 255]);
  });

  it("reports operating-system permission independently from registration", () => {
    vi.stubGlobal("Notification", { permission: "denied" });

    expect(notificationPermission()).toBe("denied");

    vi.unstubAllGlobals();
  });
});
