import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import type { StreamContext } from "../StreamContext";
import type { StreamTransformer } from "../StreamPipeline";
import type { StreamProcessorOptions } from "../StreamProcessor";

const logger = getLogger({ prefix: "RESPONSE_FORMATTER" });

export class ResponseFormatter implements StreamTransformer {
  private fullContent = "";
  private fullThinking = "";
  private signature = "";
  private citationsResponse: any[] = [];
  private usageData: any = null;
  private bufferChunks: string[] = [];
  private bufferSize = 0;
  private currentEventType = "";

  constructor(private options: StreamProcessorOptions) {}

  getName(): string {
    return "ResponseFormatter";
  }

  async transform(
    stream: ReadableStream,
    context: StreamContext,
  ): Promise<ReadableStream> {
    return stream.pipeThrough(
      new TransformStream({
        start: () => {},

        transform: (chunk, controller) => {
          try {
            const text = new TextDecoder().decode(chunk);
            this.processChunk(text, controller);
          } catch (error) {
            logger.error("Error processing chunk in response formatter", {
              error,
              completion_id: this.options.completion_id,
            });
          }
        },

        flush: (controller) => {
          context.setContent(this.fullContent);
          context.setThinking(this.fullThinking);
          context.setSignature(this.signature);
          context.setCitations(this.citationsResponse);
          context.setUsage(this.usageData);

          this.emitEvent(controller, "content_block_stop", {});

          this.cleanup();
        },
      }),
    );
  }

  private processChunk(
    text: string,
    controller: TransformStreamDefaultController,
  ): void {
    this.bufferChunks.push(text);
    this.bufferSize += text.length;

    if (this.bufferSize > 100000) {
      logger.warn("Buffer size exceeded limit, truncating", {
        completion_id: this.options.completion_id,
        bufferSize: this.bufferSize,
      });

      const combined = this.bufferChunks.join("");
      const truncated = combined.substring(combined.length - 50000);
      this.bufferChunks = [truncated];
      this.bufferSize = truncated.length;
    }

    const combined = this.bufferChunks.join("");
    const lines = combined.split("\n");

    const incompleteLine = lines.pop() || "";
    this.bufferChunks = incompleteLine ? [incompleteLine] : [];
    this.bufferSize = incompleteLine.length;

    for (const line of lines) {
      if (!line.trim()) continue;

      if (line.startsWith("event: ")) {
        this.currentEventType = line.substring(7).trim();
        continue;
      }

      if (line.startsWith("data: ")) {
        const dataStr = line.substring(6).trim();

        if (dataStr === "[DONE]") {
          this.handleStreamEnd(controller);
          return;
        }

        if (
          dataStr.length > 0 &&
          (dataStr.startsWith("{") || dataStr.startsWith("["))
        ) {
          try {
            const data = JSON.parse(dataStr);
            this.processDataEvent(data, controller);
          } catch (error) {
            logger.trace("Non-JSON data received", {
              dataStr: dataStr.substring(0, 100),
            });
          }
        }
      }
    }
  }

  private processDataEvent(
    data: any,
    controller: TransformStreamDefaultController,
  ): void {
    if (this.currentEventType === "content_block_delta") {
      if (data.delta?.text) {
        this.fullContent += data.delta.text;
        this.emitEvent(controller, "content_block_delta", {
          delta: { text: data.delta.text },
        });
      }
    } else if (this.currentEventType === "thinking_delta") {
      if (data.delta?.thinking) {
        this.fullThinking += data.delta.thinking;
      }
    } else if (data.type === "usage") {
      this.usageData = data.usage;
    } else if (data.type === "citations") {
      this.citationsResponse = data.citations || [];
    }

    controller.enqueue(
      new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`),
    );
  }

  private handleStreamEnd(controller: TransformStreamDefaultController): void {
    this.emitEvent(controller, "message_delta", {
      id: this.options.completion_id,
      object: "chat.completion",
      created: Date.now(),
      model: this.options.model,
      nonce: generateId(),
      content: this.fullContent,
      thinking: this.fullThinking,
      signature: this.signature,
      citations: this.citationsResponse,
      usage: this.usageData,
      finish_reason: "stop",
    });
  }

  private emitEvent(
    controller: TransformStreamDefaultController,
    type: string,
    payload: Record<string, any>,
  ): void {
    const event = new TextEncoder().encode(
      `data: ${JSON.stringify({ type, ...payload })}\n\n`,
    );
    controller.enqueue(event);
  }

  getContent(): string {
    return this.fullContent;
  }

  getThinking(): string {
    return this.fullThinking;
  }

  getCitations(): any[] {
    return this.citationsResponse;
  }

  getUsage(): any {
    return this.usageData;
  }

  /**
   * Clean up instance variables to prevent memory leaks
   */
  private cleanup(): void {
    this.fullContent = "";
    this.fullThinking = "";
    this.signature = "";
    this.citationsResponse = [];
    this.usageData = null;
    this.bufferChunks = [];
    this.bufferSize = 0;
    this.currentEventType = "";
  }
}
