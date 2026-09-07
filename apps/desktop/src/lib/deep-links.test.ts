import { describe, expect, it } from "vitest";

import { readDeepLinkPath } from "./deep-links";

describe("desktop deep links", () => {
  it("opens a conversation the link names", () => {
    expect(readDeepLinkPath("polychat://chat/abc-123")).toBe("/chat/abc-123");
    expect(readDeepLinkPath("polychat://chat")).toBe("/chat");
  });

  it("keeps the query a place needs to restore its filters", () => {
    expect(readDeepLinkPath("polychat://chat/files?tab=made")).toBe("/chat/files?tab=made");
  });

  it("normalises traversal away rather than letting a link escape the chat root", () => {
    expect(readDeepLinkPath("polychat://chat/../../etc/passwd")).toBe("/chat/etc/passwd");
  });

  it.each([
    "polychat://work/acme/projects/p1",
    "polychat://profile",
    "polychat://evil.example/chat",
  ])("refuses %s, which addresses somewhere this window does not serve", (link) => {
    expect(readDeepLinkPath(link)).toBeNull();
  });

  it.each([
    "https://polychat.app/chat/abc",
    "javascript:alert(1)",
    "file:///etc/passwd",
    "not a url",
    "",
    null,
    42,
  ])("refuses %s rather than navigating somewhere unsafe", (link) => {
    expect(readDeepLinkPath(link)).toBeNull();
  });
});
