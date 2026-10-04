import { expect, it } from "vitest";

import { redactTextStream } from "./redact-stream";

it("removes exact credentials across chunk boundaries without corrupting UTF-8 or event framing", async () => {
  const input = 'data: {"text":"café 🛠 dummy-token and short"}\n\ndata: [DONE]\n\n';
  const bytes = new TextEncoder().encode(input);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of bytes) {
        controller.enqueue(Uint8Array.of(byte));
      }

      controller.close();
    },
  });
  const result = await new Response(
    redactTextStream(stream, ["dummy", "dummy-token", "short"]),
  ).text();

  expect(result).toBe('data: {"text":"café 🛠 [REDACTED] and [REDACTED]"}\n\ndata: [DONE]\n\n');
});
