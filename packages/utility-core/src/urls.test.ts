import { describe, expect, it } from "vitest";

import { hasUrlExtension, isRasterDataImageUrl, normaliseSameOriginRoute } from "./urls";

const VIDEO = new Set(["mp4", "webm"]);

describe("normaliseSameOriginRoute", () => {
  it.each([
    ["  ", "/"],
    ["  /settings?tab=profile#name  ", "/settings?tab=profile#name"],
    ["https://preview.test/settings", "/settings"],
    ["https://other.test/settings", null],
    ["//other.test/settings", null],
    ["http://preview.test/settings", null],
    ["https://preview.test:444/settings", null],
    ["javascript:alert(1)", null],
    ["https://[", null],
  ])("keeps preview navigation on its origin for %s", (route, expected) => {
    expect(normaliseSameOriginRoute(route, "https://preview.test")).toBe(expected);
  });
});

describe("hasUrlExtension", () => {
  it("stays linear on input crafted to backtrack", () => {
    const hostile = ".mp4?".repeat(100_000) + "\nx";
    const startedAt = performance.now();

    expect(hasUrlExtension(hostile, VIDEO)).toBe(true);
    expect(performance.now() - startedAt).toBeLessThan(100);
  });
});

describe("isRasterDataImageUrl", () => {
  it("accepts base64 raster images only", () => {
    expect(isRasterDataImageUrl("data:image/gif;base64,R0lGODlhAQABAAAAACw=")).toBe(true);
    expect(isRasterDataImageUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(isRasterDataImageUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isRasterDataImageUrl('data:image/png;base64,AAAA"onerror=')).toBe(false);
  });
});
