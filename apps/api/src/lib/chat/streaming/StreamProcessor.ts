import type { ConversationManager } from "~/lib/conversationManager";
import type { ChatMode, IEnv, IUser, IUserSettings, Platform } from "~/types";
import { getLogger } from "~/utils/logger";
import { StreamPipeline } from "./StreamPipeline";
import { ErrorTransformer } from "./transformers/ErrorTransformer";
import { ResponseFormatter } from "./transformers/ResponseFormatter";
import { ToolCallTransformer } from "./transformers/ToolCallTransformer";

const logger = getLogger({ prefix: "STREAM_PROCESSOR" });

export interface StreamProcessorOptions {
  env: IEnv;
  completion_id: string;
  model: string;
  provider: string;
  platform?: Platform;
  user?: IUser;
  userSettings?: IUserSettings;
  app_url?: string;
  mode?: ChatMode;
  max_steps?: number;
  current_step?: number;
}

export class StreamProcessor {
  private pipeline: StreamPipeline;

  constructor(
    private options: StreamProcessorOptions,
    private conversationManager: ConversationManager,
  ) {
    this.pipeline = new StreamPipeline();
    this.setupPipeline();
  }

  private setupPipeline(): void {
    this.pipeline
      .addTransformer(new ErrorTransformer(this.options))
      .addTransformer(new ResponseFormatter(this.options))
      .addTransformer(
        new ToolCallTransformer(this.options, this.conversationManager),
      );
  }

  async processStream(providerStream: ReadableStream): Promise<ReadableStream> {
    logger.debug("Starting stream processing", {
      completion_id: this.options.completion_id,
      model: this.options.model,
      provider: this.options.provider,
    });

    try {
      const streamWithUsageLimits = this.addUsageLimitsEvent(providerStream);
      return await this.pipeline.process(streamWithUsageLimits);
    } catch (error) {
      logger.error("Stream processing failed", {
        error,
        completion_id: this.options.completion_id,
      });
      throw error;
    }
  }

  private addUsageLimitsEvent(stream: ReadableStream): ReadableStream {
    const options = this.options;
    const conversationManager = this.conversationManager;

    return stream.pipeThrough(
      new TransformStream({
        async start(controller) {
          try {
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
          } catch (error) {
            logger.error("Failed to get usage limits", {
              error,
              completion_id: options.completion_id,
            });
          }
        },

        transform(chunk, controller) {
          controller.enqueue(chunk);
        },
      }),
    );
  }

  static async create(
    providerStream: ReadableStream,
    options: StreamProcessorOptions,
    conversationManager: ConversationManager,
  ): Promise<ReadableStream> {
    const processor = new StreamProcessor(options, conversationManager);
    return processor.processStream(providerStream);
  }
}
