import { describe, expect, it, vi } from "vitest";

import {
  UnsafeUrlError,
  fetchFollowingSafeRedirects,
  headersToRecord,
  isPublicHttpUrl,
  parseBearerToken,
  readHttpResponseBody,
  readResponseTextWithinLimit,
  setDefaultHeader,
} from "../http";

describe("parseBearerToken", () => {
  it("accepts a single Bearer token", () => {
    expect(parseBearerToken("Bearer ak_test.123_abc-def")).toBe("ak_test.123_abc-def");
    expect(parseBearerToken("bearer jwt.payload.signature")).toBe("jwt.payload.signature");
  });

  it("rejects malformed authorization values", () => {
    expect(parseBearerToken(undefined)).toBeUndefined();
    expect(parseBearerToken("Basic credentials")).toBeUndefined();
    expect(parseBearerToken("prefix Bearer token")).toBeUndefined();
    expect(parseBearerToken("Bearer token suffix")).toBeUndefined();
  });
});

describe("http utilities", () => {
  it("maps headers to a plain record", () => {
    const headers = new Headers({
      "content-type": "application/json",
      "x-request-id": "request-1",
    });

    expect(headersToRecord(headers)).toEqual({
      "content-type": "application/json",
      "x-request-id": "request-1",
    });
  });

  it("sets default headers case-insensitively", () => {
    const headers = { "content-type": "text/plain" };

    setDefaultHeader(headers, "Content-Type", "application/json");
    setDefaultHeader(headers, "Accept", "application/json");

    expect(headers).toEqual({
      Accept: "application/json",
      "content-type": "text/plain",
    });
  });

  it("reads JSON response bodies", async () => {
    const response = new Response(JSON.stringify({ ok: true }));

    await expect(readHttpResponseBody(response)).resolves.toEqual({
      body: { ok: true },
      format: "json",
      parsed: { ok: true },
      raw: '{"ok":true}',
    });
  });

  it("falls back to text response bodies", async () => {
    const response = new Response("not json");

    await expect(readHttpResponseBody(response)).resolves.toEqual({
      body: "not json",
      format: "text",
      parsed: null,
      raw: "not json",
    });
  });

  it("bounds streamed response bodies by encoded bytes", async () => {
    await expect(readResponseTextWithinLimit(new Response("café"), 5)).resolves.toBe("café");
    await expect(readResponseTextWithinLimit(new Response("too large"), 3)).rejects.toThrow(
      "3-byte limit",
    );
  });

  it("rejects an oversized declared content length before reading", async () => {
    const response = new Response("small", { headers: { "content-length": "100" } });

    await expect(readResponseTextWithinLimit(response, 10)).rejects.toThrow("10-byte limit");
  });
});

describe("isPublicHttpUrl", () => {
  it("allows public http and https hosts", () => {
    expect(isPublicHttpUrl(new URL("https://example.com/image.png"))).toBe(true);
    expect(isPublicHttpUrl(new URL("http://8.8.8.8/"))).toBe(true);
  });

  it("rejects private hosts and non-http protocols", () => {
    expect(isPublicHttpUrl(new URL("http://169.254.169.254/latest/meta-data"))).toBe(false);
    expect(isPublicHttpUrl(new URL("http://localhost:3000/"))).toBe(false);
    expect(isPublicHttpUrl(new URL("http://10.0.0.5/"))).toBe(false);
    expect(isPublicHttpUrl(new URL("file:///etc/passwd"))).toBe(false);
  });
});

describe("fetchFollowingSafeRedirects", () => {
  it("refuses a private initial URL without issuing a request", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(
        fetchFollowingSafeRedirects("http://169.254.169.254/latest/meta-data"),
      ).rejects.toBeInstanceOf(UnsafeUrlError);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("follows a redirect to a public host", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "https://cdn.example.com/a.png" } }),
      )
      .mockResolvedValueOnce(new Response("image", { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    try {
      const response = await fetchFollowingSafeRedirects("https://example.com/a.png");

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][0]).toBe("https://cdn.example.com/a.png");
      expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
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

  it("downgrades a redirected POST to GET", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 303, headers: { location: "https://example.com/done" } }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    try {
      await fetchFollowingSafeRedirects("https://example.com/submit", {
        method: "POST",
        body: "payload",
      });

      expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "GET", body: undefined });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
