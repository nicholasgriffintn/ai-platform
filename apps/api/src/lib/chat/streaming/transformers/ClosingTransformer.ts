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

    return stream.pipeThrough(
      new TransformStream({
        start(controller) {
          logger.debug("Closing transformer initialized", {
            completion_id: options.completion_id,
          });
        },

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

          logger.debug("Closing transformer flushed - stream complete", {
            completion_id: options.completion_id,
          });
        },
      }),
    );
  }
}
