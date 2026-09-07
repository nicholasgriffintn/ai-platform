import { describe, expect, it } from "vitest";

import { readDeepLinkPath, subscribeToDeepLinks } from "./deep-links";

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

  it("opens the Work surfaces a notification points at", () => {
    expect(readDeepLinkPath("polychat://work/acme/projects/p1/tasks/t1")).toBe(
      "/work/acme/projects/p1/tasks/t1",
    );
    expect(readDeepLinkPath("polychat://work/attention")).toBe("/work/attention");
  });

  it("opens a settings tab the link names", () => {
    expect(readDeepLinkPath("polychat://profile?tab=billing")).toBe("/profile?tab=billing");
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

describe("subscribing to deep links", () => {
  it("opens the path a link names", async () => {
    const opened: string[] = [];
    let deliver: ((event: { payload: unknown }) => void) | undefined;
    const stop = subscribeToDeepLinks(async (_event, handler) => {
      deliver = handler;

      return () => undefined;
    }, opened.push.bind(opened));

    await Promise.resolve();
    deliver?.({ payload: "polychat://chat/abc" });

    expect(opened).toEqual(["/chat/abc"]);
    stop();
  });

  it("survives a bridge that refuses to listen rather than rejecting into nothing", async () => {
    const stop = subscribeToDeepLinks(
      () => Promise.reject(new Error("The desktop bridge is not available.")),
      () => undefined,
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(stop).not.toThrow();
  });

  it("stops listening once the window is done with it", async () => {
    let stopped = false;
    const stop = subscribeToDeepLinks(
      async () => () => {
        stopped = true;
      },
      () => undefined,
    );

    await Promise.resolve();
    await Promise.resolve();
    stop();

    expect(stopped).toBe(true);
  });

  it("ignores a link that arrives after the window stopped listening", async () => {
    const opened: string[] = [];
    let deliver: ((event: { payload: unknown }) => void) | undefined;
    const stop = subscribeToDeepLinks(async (_event, handler) => {
      deliver = handler;

      return () => undefined;
    }, opened.push.bind(opened));

    await Promise.resolve();
    stop();
    deliver?.({ payload: "polychat://chat/abc" });

    expect(opened).toEqual([]);
  });
});
