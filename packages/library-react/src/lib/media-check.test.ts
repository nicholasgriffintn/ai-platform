import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkMediaFile,
  checkMediaUrl,
  describeMediaCheck,
  MAX_CHECKABLE_BYTES,
} from "./media-check";

const FINGERPRINT = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

describe("checkMediaFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends only the SHA-256 of the file and returns its record", async () => {
    const entry = {
      fingerprint: FINGERPRINT,
      status: "marked",
      container: "png",
      recordedAt: "2026-11-06T12:00:00.000Z",
    };
    const fetchMock = stubFetch(new Response(JSON.stringify(entry)));

    await expect(checkMediaFile(new Blob(["hello"]))).resolves.toEqual({ kind: "found", entry });
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(new RegExp(`/provenance/${FINGERPRINT}$`));
    expect(fetchMock.mock.calls[0]?.[1]).toBeUndefined();
  });

  it("reports no record rather than a failure when the lookup returns 404", async () => {
    stubFetch(new Response(null, { status: 404 }));

    await expect(checkMediaFile(new Blob(["hello"]))).resolves.toEqual({ kind: "no-record" });
  });

  it("reports the check as unavailable when rate limited", async () => {
    stubFetch(new Response(null, { status: 429 }));

    await expect(checkMediaFile(new Blob(["hello"]))).resolves.toEqual({ kind: "unavailable" });
  });

  it("refuses to read a file too large for the browser", async () => {
    const fetchMock = stubFetch(new Response(null));
    const file = new Blob(["hello"]);

    Object.defineProperty(file, "size", { value: MAX_CHECKABLE_BYTES + 1 });

    await expect(checkMediaFile(file)).resolves.toEqual({ kind: "too-large" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("checkMediaUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats a file it cannot read as unavailable, not as having no record", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(checkMediaUrl("https://example.com/a.png")).resolves.toEqual({
      kind: "unavailable",
    });
  });
});

describe("describeMediaCheck", () => {
  it("does not let a missing record read as proof a file is not AI-generated", () => {
    expect(describeMediaCheck({ kind: "no-record" }).detail).toContain("doesn't tell you");
  });
});
