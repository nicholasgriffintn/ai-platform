import type { ConversationManager } from "~/lib/conversationManager";
import type { ChatMode, IEnv, IUser, IUserSettings, Platform } from "~/types";
import { getLogger } from "~/utils/logger";
import { StreamPipeline } from "./StreamPipeline";
import { ClosingTransformer } from "./transformers/ClosingTransformer";
import { ErrorTransformer } from "./transformers/ErrorTransformer";
import { InitTransformer } from "./transformers/InitTransformer";
import { PostProcessingTransformer } from "./transformers/PostProcessingTransformer";
import { ResponseFormatter } from "./transformers/ResponseFormatter";

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
      .addTransformer(
        new InitTransformer(this.options, this.conversationManager),
      )
      .addTransformer(new ErrorTransformer(this.options))
      .addTransformer(new ResponseFormatter(this.options))
      .addTransformer(
        new PostProcessingTransformer(this.options, this.conversationManager),
      )
      .addTransformer(new ClosingTransformer(this.options));
  }

  async processStream(providerStream: ReadableStream): Promise<ReadableStream> {
    logger.debug("Starting stream processing", {
      completion_id: this.options.completion_id,
      model: this.options.model,
      provider: this.options.provider,
    });

    try {
      return await this.pipeline.process(providerStream);
    } catch (error) {
      logger.error("Stream processing failed", {
        error,
        completion_id: this.options.completion_id,
      });
      throw error;
    }
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
