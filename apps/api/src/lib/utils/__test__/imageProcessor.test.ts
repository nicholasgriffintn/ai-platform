import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getImageFormat,
  validateImageFormat,
  validateImageSize,
  fetchImageAsBase64,
  isValidImageUrl,
} from "../imageProcessor";

const EXAMPLE_BASE64 = btoa("hello world");

describe("imageProcessor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("detects image format from URL extension", () => {
    expect(getImageFormat("https://example.com/a.png")).toBe("png");
    expect(getImageFormat("https://example.com/a.jpg")).toBe("jpeg");
    expect(getImageFormat("https://example.com/a.jpeg")).toBe("jpeg");
    expect(getImageFormat("https://example.com/a.webp")).toBe("webp");
    expect(getImageFormat("https://example.com/a.gif")).toBe("gif");
  });

  it("validates supported formats", () => {
    expect(validateImageFormat("https://x/y.png")).toBe(true);
    expect(validateImageFormat("https://x/y.jpeg")).toBe(true);
    expect(validateImageFormat("https://x/y.jpg")).toBe(true);
    expect(validateImageFormat("https://x/y.webp")).toBe(true);
    expect(validateImageFormat("https://x/y.gif")).toBe(true);
    expect(validateImageFormat("https://x/y.svg")).toBe(false);
    expect(validateImageFormat("https://x/y.bmp")).toBe(false);
  });

  it("validates size under 25MB", () => {
    expect(validateImageSize(new Uint8Array(10))).toBe(true);
    expect(validateImageSize(new Uint8Array(25 * 1024 * 1024))).toBe(true);
    expect(validateImageSize(new Uint8Array(25 * 1024 * 1024 + 1))).toBe(false);
  });

  it("handles data URLs for fetchImageAsBase64", async () => {
    const dataUrl = `data:image/png;base64,${EXAMPLE_BASE64}`;
    const base64 = await fetchImageAsBase64(dataUrl);
    expect(base64).toBe(EXAMPLE_BASE64);
  });

  it("rejects invalid URLs", async () => {
    await expect(fetchImageAsBase64("notaurl")).rejects.toThrow(/Invalid image URL/);
  });

  it("fetches and converts remote images to base64", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      headers: new Headers({ "content-type": "image/png", "content-length": "11" }),
      arrayBuffer: async () => new TextEncoder().encode("hello world").buffer,
    })) as any);

    const base64 = await fetchImageAsBase64("https://example.com/img.png");
    expect(typeof base64).toBe("string");
  });

  it("respects content-length > 25MB", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      headers: new Headers({ "content-type": "image/png", "content-length": String(26 * 1024 * 1024) }),
      arrayBuffer: async () => new ArrayBuffer(0),
    })) as any);

    await expect(fetchImageAsBase64("https://example.com/too-big.png")).rejects.toThrow(/exceeds 25MB/);
  });

  it("rejects unsupported mime types", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      headers: new Headers({ "content-type": "image/svg+xml", "content-length": "10" }),
      arrayBuffer: async () => new ArrayBuffer(10),
    })) as any);

    await expect(fetchImageAsBase64("https://example.com/img.svg")).rejects.toThrow(/not supported/);
  });

  it("validates URL forms", () => {
    expect(isValidImageUrl("https://example.com/a.png")).toBe(true);
    expect(isValidImageUrl("http://example.com/a.png")).toBe(true);
    expect(isValidImageUrl("data:image/png;base64,AAA")).toBe(true);
    expect(isValidImageUrl("notaurl")).toBe(false);
  });
});