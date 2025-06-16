import type { ConversationManager } from "~/lib/conversationManager";
import { getLogger } from "~/utils/logger";
import type { StreamContext } from "../StreamContext";
import type { StreamTransformer } from "../StreamPipeline";
import type { StreamProcessorOptions } from "../StreamProcessor";

const logger = getLogger({ prefix: "INIT_TRANSFORMER" });

export class InitTransformer implements StreamTransformer {
  constructor(
    private options: StreamProcessorOptions,
    private conversationManager: ConversationManager,
  ) {}

  getName(): string {
    return "InitTransformer";
  }

  async transform(
    stream: ReadableStream,
    context: StreamContext,
  ): Promise<ReadableStream> {
    const options = this.options;
    const conversationManager = this.conversationManager;

    return stream.pipeThrough(
      new TransformStream({
        async start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                type: "state",
                state: "init",
              })}\n\n`,
            ),
          );

          if (conversationManager) {
            const usageLimits = await conversationManager.getUsageLimits();
            if (usageLimits) {
              const usageEvent = new TextEncoder().encode(
                `data: ${JSON.stringify({
                  type: "usage_limits",
                  usage_limits: usageLimits,
                })}\n\n`,
              );
              controller.enqueue(usageEvent);
            }
          }

          controller.enqueue(
            new TextEncoder().encode(
              `data: ${JSON.stringify({
                type: "state",
                state: "thinking",
              })}\n\n`,
            ),
          );

          logger.debug("Init transformer initialized", {
            completion_id: options.completion_id,
          });
        },

        flush: () => {
          logger.debug("Init transformer flushed", {
            completion_id: options.completion_id,
          });
        },
      }),
    );
  }
}
