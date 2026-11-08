import { describe, expect, it } from "vitest";

import { readDeepLinkPath } from "./deep-links";

describe("desktop deep links", () => {
  it("normalises traversal away rather than letting a link escape the chat root", () => {
    expect(readDeepLinkPath("polychat://chat/../../etc/passwd")).toBe("/chat/etc/passwd");
  });

  it.each(["polychat://evil.example/chat", "polychat://pricing", "polychat://s/share-id"])(
    "refuses %s, which addresses somewhere this window does not serve",
    (link) => {
      expect(readDeepLinkPath(link)).toBeNull();
    },
  );

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
