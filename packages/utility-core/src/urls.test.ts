import { describe, expect, it } from "vitest";

import { hasUrlExtension, readUrlExtension, readUrlPath } from "./urls";

const VIDEO = new Set(["mp4", "webm"]);

describe("readUrlPath", () => {
  it("drops the query and fragment", () => {
    expect(readUrlPath("https://a.test/clip.mp4?token=1")).toBe("https://a.test/clip.mp4");
    expect(readUrlPath("https://a.test/clip.mp4#t=3")).toBe("https://a.test/clip.mp4");
    expect(readUrlPath("https://a.test/clip.mp4#t=3?x")).toBe("https://a.test/clip.mp4");
    expect(readUrlPath("https://a.test/clip.mp4")).toBe("https://a.test/clip.mp4");
  });
});

describe("readUrlExtension", () => {
  it("lowercases the extension", () => {
    expect(readUrlExtension("https://a.test/clip.MP4")).toBe("mp4");
  });

  it("ignores dots in earlier path segments", () => {
    expect(readUrlExtension("https://a.test/v1.2/clip")).toBeUndefined();
  });

  it("returns nothing for a trailing dot or no dot", () => {
    expect(readUrlExtension("https://a.test/clip.")).toBeUndefined();
    expect(readUrlExtension("https://a.test/clip")).toBeUndefined();
  });
});

describe("hasUrlExtension", () => {
  it("matches on the path, not on the query string", () => {
    expect(hasUrlExtension("https://a.test/clip.mp4", VIDEO)).toBe(true);
    expect(hasUrlExtension("https://a.test/clip.mp4?token=1", VIDEO)).toBe(true);
    expect(hasUrlExtension("https://a.test/watch?file=clip.mp4", VIDEO)).toBe(false);
    expect(hasUrlExtension("https://a.test/clip.png", VIDEO)).toBe(false);
  });

  it("stays linear on input crafted to backtrack", () => {
    const hostile = ".mp4?".repeat(100_000) + "\nx";
    const startedAt = performance.now();

    expect(hasUrlExtension(hostile, VIDEO)).toBe(true);
    expect(performance.now() - startedAt).toBeLessThan(100);
  });

  it("stays linear on a long non-matching path", () => {
    const hostile = `https://a.test/${"segment.".repeat(100_000)}png`;
    const startedAt = performance.now();

    expect(hasUrlExtension(hostile, VIDEO)).toBe(false);
    expect(performance.now() - startedAt).toBeLessThan(100);
  });
});
