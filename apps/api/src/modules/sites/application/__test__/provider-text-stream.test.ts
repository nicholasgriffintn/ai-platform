import { describe, expect, it, vi } from "vitest";

import { readProviderTextStream } from "~/modules/sites/application/provider-text-stream";

function providerStream(events: Record<string, unknown>[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      controller.close();
    },
  });
}

describe("readProviderTextStream", () => {
  it("reports provider reasoning before yielding visible output", async () => {
    const onReasoning = vi.fn();
    const stream = providerStream([
      { type: "response.reasoning_summary_text.delta", delta: "Planning the page structure" },
      { type: "response.output_text.delta", delta: '{"op":"add"}\n' },
    ]);
    const output: string[] = [];

    for await (const delta of readProviderTextStream(stream, undefined, onReasoning)) {
      output.push(delta);
    }

    expect(onReasoning).toHaveBeenCalledWith("Planning the page structure");
    expect(output).toEqual(['{"op":"add"}\n']);
  });
});
