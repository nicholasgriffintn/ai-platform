import type { ConversationManager } from "~/lib/conversationManager";
import type { StreamContext } from "../StreamContext";
import type { StreamTransformer } from "../StreamPipeline";
import type { StreamProcessorOptions } from "../StreamProcessor";

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
        },

        flush: () => {
          this.cleanup();
        },
      }),
    );
  }

  /**
   * Clean up instance variables to prevent memory leaks
   */
  private cleanup(): void {}
}
