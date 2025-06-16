import { getLogger } from "~/utils/logger";
import type { StreamContext } from "../StreamContext";
import type { StreamTransformer } from "../StreamPipeline";
import type { StreamProcessorOptions } from "../StreamProcessor";

const logger = getLogger({ prefix: "CLOSING_TRANSFORMER" });

export class ClosingTransformer implements StreamTransformer {
  constructor(private options: StreamProcessorOptions) {}

  getName(): string {
    return "ClosingTransformer";
  }

  async transform(
    stream: ReadableStream,
    context: StreamContext,
  ): Promise<ReadableStream> {
    const options = this.options;
    const self = this;

    return stream.pipeThrough(
      new TransformStream({
        start() {},

        transform(chunk, controller) {
          controller.enqueue(chunk);
        },

        flush(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                type: "state",
                state: "done",
              })}\n\n`,
            ),
          );

          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));

          self.cleanup();
        },
      }),
    );
  }

  /**
   * Clean up instance variables to prevent memory leaks
   */
  private cleanup(): void {}
}
