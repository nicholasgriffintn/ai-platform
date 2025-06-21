import { getLogger } from "~/utils/logger";
import type { StreamContext } from "../StreamContext";
import type { StreamTransformer } from "../StreamPipeline";
import type { StreamProcessorOptions } from "../StreamProcessor";

const logger = getLogger({ prefix: "ERROR_TRANSFORMER" });

export class ErrorTransformer implements StreamTransformer {
  constructor(private options: StreamProcessorOptions) {}

  getName(): string {
    return "ErrorTransformer";
  }

  async transform(
    stream: ReadableStream,
    context: StreamContext,
  ): Promise<ReadableStream> {
    const options = this.options;
    const self = this;

    return stream.pipeThrough(
      new TransformStream({
        start(controller) {},

        transform(chunk, controller) {
          try {
            controller.enqueue(chunk);
          } catch (error) {
            logger.error("Error in stream chunk processing", {
              error,
              completion_id: options.completion_id,
            });

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

        flush() {
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
