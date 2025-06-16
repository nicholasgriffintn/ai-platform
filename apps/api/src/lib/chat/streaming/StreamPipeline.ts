import { getLogger } from "~/utils/logger";
import { StreamContext } from "./StreamContext";

const logger = getLogger({ prefix: "STREAM_PIPELINE" });

export interface StreamTransformer {
  transform(
    stream: ReadableStream,
    context: StreamContext,
  ): Promise<ReadableStream>;
  getName(): string;
}

export class StreamPipeline {
  private transformers: StreamTransformer[] = [];

  addTransformer(transformer: StreamTransformer): StreamPipeline {
    this.transformers.push(transformer);
    return this;
  }

  async process(inputStream: ReadableStream): Promise<ReadableStream> {
    logger.debug("Processing stream through pipeline", {
      transformerCount: this.transformers.length,
      transformers: this.transformers.map((t) => t.getName()),
    });

    let currentStream = inputStream;
    const context = new StreamContext();

    for (const transformer of this.transformers) {
      try {
        logger.trace("Applying transformer", {
          transformer: transformer.getName(),
        });
        currentStream = await transformer.transform(currentStream, context);
      } catch (error) {
        logger.error("Transformer failed", {
          transformer: transformer.getName(),
          error,
        });
        throw error;
      }
    }

    return currentStream;
  }

  getTransformerCount(): number {
    return this.transformers.length;
  }

  getTransformerNames(): string[] {
    return this.transformers.map((t) => t.getName());
  }
}
