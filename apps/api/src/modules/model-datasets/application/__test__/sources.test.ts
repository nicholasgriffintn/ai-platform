import { describe, expect, it, vi } from "vitest";

import { httpAsyncBuffer, streamRows } from "../sources";

describe("remote dataset ranges", () => {
  it("rejects ignored or incorrect ranges instead of passing corrupt offsets to Parquet", async () => {
    const cancel = vi.fn();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(new ReadableStream({ cancel })))
      .mockResolvedValueOnce(
        new Response("ab", { status: 206, headers: { "content-range": "bytes 0-1/10" } }),
      );
    const file = httpAsyncBuffer("https://example.com/data.parquet", 10, {}, fetcher);

    await expect(file.slice(5, 7)).rejects.toThrow("requested byte range");
    expect(cancel).toHaveBeenCalledOnce();
    await expect(file.slice(5, 7)).rejects.toThrow("requested byte range");
  });

  it("accepts an exact range and detects truncated responses", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("ab", { status: 206, headers: { "content-range": "bytes 5-6/10" } }),
      )
      .mockResolvedValueOnce(
        new Response("a", { status: 206, headers: { "content-range": "bytes 5-6/10" } }),
      );
    const file = httpAsyncBuffer("https://example.com/data.parquet", 10, {}, fetcher);

    expect(new TextDecoder().decode(await file.slice(5, 7))).toBe("ab");
    await expect(file.slice(5, 7)).rejects.toThrow("incomplete byte range");
  });
});

it("cancels CSV downloads when a preview stops after its first row", async () => {
  const cancel = vi.fn();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("text\nfirst\nsecond\n"));
    },
    cancel,
  });

  for await (const row of streamRows("csv", stream, 18)) {
    expect(row).toEqual({ text: "first" });
    break;
  }

  expect(cancel).toHaveBeenCalledOnce();
  expect(stream.locked).toBe(false);
});
