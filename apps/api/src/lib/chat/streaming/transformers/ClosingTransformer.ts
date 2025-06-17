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
          try {
            controller.enqueue(chunk);
          } catch (error) {
            logger.error("Failed in stream transform:", error);

            const errorEvent = new TextEncoder().encode(
              `data: ${JSON.stringify({
                type: "error",
                error: {
                  message: "Stream processing error",
                  code: "STREAM_ERROR",
                  details:
                    error instanceof Error ? error.message : String(error),
                },
                completion_id: options.completion_id,
              })}\n\n`,
            );

            controller.enqueue(errorEvent);
          }
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
