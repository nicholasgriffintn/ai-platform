import { describe, expect, it, vi } from "vitest";

import { finaliseReadableStream } from "../finalise-readable-stream";

describe("finaliseReadableStream", () => {
  it("runs cleanup exactly once when the source errors", async () => {
    const cleanup = vi.fn(async () => undefined);
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.error(new Error("provider failed"));
      },
    });
    const reader = finaliseReadableStream({ stream: source, cleanup }).getReader();

    await expect(reader.read()).resolves.toEqual({ done: true, value: undefined });
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("runs cleanup exactly once when the consumer cancels", async () => {
    const cleanup = vi.fn(async () => undefined);
    const source = new ReadableStream<Uint8Array>();
    const stream = finaliseReadableStream({ stream: source, cleanup });

    await stream.cancel("client disconnected");
    expect(cleanup).toHaveBeenCalledOnce();
  });
});
