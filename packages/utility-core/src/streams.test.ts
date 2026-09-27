import { describe, expect, it, vi } from "vitest";

import { readTextLines } from "./streams.js";

describe("streamed text lines", () => {
  it("cancels the source when a preview stops before the stream ends", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("first\nsecond\n"));
      },
      cancel,
    });
    const lines: string[] = [];

    for await (const line of readTextLines(stream)) {
      lines.push(line);
      break;
    }

    expect(lines).toEqual(["first"]);
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
  });
});
