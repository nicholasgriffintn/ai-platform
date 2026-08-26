import { afterEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";

import { fetchPublicUrl, parsePublicHttpUrl } from "../outbound-url";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parsePublicHttpUrl", () => {
  it("allows public http(s) URLs", () => {
    expect(parsePublicHttpUrl("https://example.com/video.mp4").toString()).toBe(
      "https://example.com/video.mp4",
    );
    expect(parsePublicHttpUrl("http://example.com/video.mp4").toString()).toBe(
      "http://example.com/video.mp4",
    );
  });

  it("rejects malformed URLs", () => {
    expect(() => parsePublicHttpUrl("not a url")).toThrow(AssistantError);
  });

  it("rejects non-http(s) schemes", () => {
    expect(() => parsePublicHttpUrl("s3://bucket/key")).toThrow(AssistantError);
    expect(() => parsePublicHttpUrl("file:///etc/passwd")).toThrow(AssistantError);
    expect(() => parsePublicHttpUrl("ftp://example.com/file")).toThrow(AssistantError);
  });

  it("rejects loopback hosts", () => {
    expect(() => parsePublicHttpUrl("http://localhost/")).toThrow(AssistantError);
    expect(() => parsePublicHttpUrl("http://127.0.0.1/")).toThrow(AssistantError);
    expect(() => parsePublicHttpUrl("http://[::1]/")).toThrow(AssistantError);
  });

  it("rejects link-local hosts", () => {
    expect(() => parsePublicHttpUrl("http://169.254.169.254/")).toThrow(AssistantError);
    expect(() => parsePublicHttpUrl("http://[fe80::1]/")).toThrow(AssistantError);
  });

  it("rejects private/reserved IP ranges", () => {
    expect(() => parsePublicHttpUrl("http://10.0.0.5/")).toThrow(AssistantError);
    expect(() => parsePublicHttpUrl("http://172.16.4.4/")).toThrow(AssistantError);
    expect(() => parsePublicHttpUrl("http://192.168.1.10/")).toThrow(AssistantError);
    expect(() => parsePublicHttpUrl("http://100.64.0.1/")).toThrow(AssistantError);
  });

  it("rejects alternate numeric encodings of private IPs", () => {
    expect(() => parsePublicHttpUrl("http://2130706433/")).toThrow(AssistantError);
    expect(() => parsePublicHttpUrl("http://0x7f000001/")).toThrow(AssistantError);
    expect(() => parsePublicHttpUrl("http://017700000001/")).toThrow(AssistantError);
    expect(() => parsePublicHttpUrl("http://127.1/")).toThrow(AssistantError);
  });

  it("rejects internal/local hostname suffixes", () => {
    expect(() => parsePublicHttpUrl("http://service.internal/")).toThrow(AssistantError);
    expect(() => parsePublicHttpUrl("http://printer.local/")).toThrow(AssistantError);
  });
});

describe("fetchPublicUrl", () => {
  it("fetches an allowed public URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchPublicUrl("https://example.com/video.mp4", {
      method: "HEAD",
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/video.mp4",
      expect.objectContaining({ method: "HEAD", redirect: "manual" }),
    );
  });

  it("rejects a blocked target before any request is made", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
      AssistantError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows a redirect to another public host", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "https://cdn.example.com/video.mp4" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchPublicUrl("https://example.com/video.mp4");

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://cdn.example.com/video.mp4",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("rejects a redirect to a private target", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicUrl("https://example.com/redirect")).rejects.toThrow(AssistantError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after too many redirects", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://example.com/next" },
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPublicUrl("https://example.com/start")).rejects.toThrow(AssistantError);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });
});
