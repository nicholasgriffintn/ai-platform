import { describe, expect, it, vi } from "vitest";

import { UnsafeUrlError, fetchFollowingSafeRedirects, parseBearerToken } from "../http.js";

describe("parseBearerToken", () => {
  it("rejects malformed authorization values", () => {
    expect(parseBearerToken(undefined)).toBeUndefined();
    expect(parseBearerToken("Basic credentials")).toBeUndefined();
    expect(parseBearerToken("prefix Bearer token")).toBeUndefined();
    expect(parseBearerToken("Bearer token suffix")).toBeUndefined();
  });
});

describe("fetchFollowingSafeRedirects", () => {
  it("retains credentials on the same origin and strips them before a cross-origin redirect", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/next" } }))
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "https://cdn.example.com/final" } }),
      )
      .mockResolvedValueOnce(new Response("ok"));

    vi.stubGlobal("fetch", fetchMock);
    const originalHeaders = {
      Authorization: "Bearer test-token",
      Cookie: "session=test",
      "X-API-Key": "test-key",
      Accept: "application/json",
    };

    try {
      await fetchFollowingSafeRedirects("https://example.com/start", { headers: originalHeaders });
      const sameOrigin = new Headers(fetchMock.mock.calls[1][1].headers);
      const crossOrigin = new Headers(fetchMock.mock.calls[2][1].headers);

      expect(sameOrigin.get("authorization")).toBe("Bearer test-token");
      expect(crossOrigin.get("authorization")).toBeNull();
      expect(crossOrigin.get("cookie")).toBeNull();
      expect(crossOrigin.get("x-api-key")).toBeNull();
      expect(crossOrigin.get("accept")).toBe("application/json");
      expect(originalHeaders.Authorization).toBe("Bearer test-token");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("refuses a redirect that points at a private host", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(fetchFollowingSafeRedirects("https://example.com/a.png")).rejects.toBeInstanceOf(
        UnsafeUrlError,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
