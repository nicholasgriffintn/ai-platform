import { ResponseFormatter as ResponseFormatterUtil } from "~/lib/formatter/responses";
import { StreamingFormatter } from "~/lib/formatter/streaming";
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
  private currentEventType = "";
  private currentToolCalls: Record<string, any> = {};
  private toolCallsData: any[] = [];
  private buffer = "";
  private context?: StreamContext;

  constructor(private options: StreamProcessorOptions) {}

  getName(): string {
    return "ResponseFormatter";
  }

  async transform(
    stream: ReadableStream,
    context: StreamContext,
  ): Promise<ReadableStream> {
    this.context = context;
    return stream.pipeThrough(
      new TransformStream({
        start: () => {},

        transform: async (chunk, controller) => {
          try {
            let text;
            try {
              text = new TextDecoder().decode(chunk);
            } catch (error) {
              return;
            }
            await this.processChunk(text, controller);
          } catch (error) {
            logger.error("Error processing chunk in response formatter", {
              error,
              completion_id: this.options.completion_id,
            });
          }
        },

        flush: () => {
          context.setContent(this.fullContent);
          context.setThinking(this.fullThinking);
          context.setSignature(this.signature);
          context.setCitations(this.citationsResponse);
          context.setUsage(this.usageData);

          this.cleanup();
        },
      }),
    );
  }

  private async processChunk(
    text: string,
    controller: TransformStreamDefaultController,
  ): Promise<void> {
    if (this.buffer.length > 100000) {
      this.buffer = this.buffer.substring(this.buffer.length - 50000);
    }

    this.buffer += text;

    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      if (line.startsWith("event: ")) {
        this.currentEventType = line.substring(7).trim();
        continue;
      }

      if (line.startsWith("data: ")) {
        const dataStr = line.substring(6).trim();

        if (dataStr === "[DONE]") {
          if (
            Object.keys(this.currentToolCalls).length > 0 &&
            this.toolCallsData.length === 0
          ) {
            const completeToolCalls = Object.values(this.currentToolCalls);
            this.toolCallsData = completeToolCalls;
          }

          this.handleStreamEnd(controller);
          return;
        }

        try {
          let data;
          if (
            dataStr.length > 0 &&
            (dataStr.startsWith("{") || dataStr.startsWith("["))
          ) {
            data = JSON.parse(dataStr);
            await this.processDataEvent(data, controller);
          }
        } catch (parseError) {
          logger.error("Parse error on data", {
            error: parseError,
            data: dataStr,
          });
        }
      }
    }
  }

  private async processDataEvent(
    data: any,
    controller: TransformStreamDefaultController,
  ): Promise<void> {
    if (data.error) {
      const errorEvent = new TextEncoder().encode(
        `data: ${JSON.stringify({
          type: "error",
          error: data.error,
        })}\n\n`,
      );
      controller.enqueue(errorEvent);
      controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      logger.error("Error in data", { error: data.error });
      this.handleStreamEnd(controller);
      return;
    }

    const formattedData = await ResponseFormatterUtil.formatResponse(
      data,
      this.options.provider,
      {
        model: this.options.model,
        type: this.options.modelConfig?.type,
        env: this.options.env,
      },
    );

    if (StreamingFormatter.isCompletionIndicated(data)) {
      const contentDelta = StreamingFormatter.extractContentFromChunk(
        data,
        this.currentEventType,
      );
      if (contentDelta) {
        this.fullContent += contentDelta;

        const contentDeltaEvent = new TextEncoder().encode(
          `data: ${JSON.stringify({
            type: "content_block_delta",
            content: contentDelta,
          })}\n\n`,
        );
        controller.enqueue(contentDeltaEvent);
      }

      const extractedUsage = StreamingFormatter.extractUsageData(data);
      if (extractedUsage) {
        this.usageData = extractedUsage;
      }

      const extractedCitations = StreamingFormatter.extractCitations(data);
      if (extractedCitations.length > 0) {
        this.citationsResponse = extractedCitations;
      }

      this.handleStreamEnd(controller);
      return;
    }

    let contentDelta = "";

    if (data.choices?.[0]?.delta?.content !== undefined) {
      contentDelta = data.choices[0].delta.content;
    } else {
      contentDelta = StreamingFormatter.extractContentFromChunk(
        formattedData,
        this.currentEventType,
      );
    }

    if (contentDelta) {
      this.fullContent += contentDelta;

      const contentDeltaEvent = new TextEncoder().encode(
        `data: ${JSON.stringify({
          type: "content_block_delta",
          content: contentDelta,
        })}\n\n`,
      );
      controller.enqueue(contentDeltaEvent);
    }

    const thinkingData = StreamingFormatter.extractThinkingFromChunk(
      data,
      this.currentEventType,
    );

    if (thinkingData) {
      if (typeof thinkingData === "string") {
        this.fullThinking += thinkingData;

        const thinkingDeltaEvent = new TextEncoder().encode(
          `data: ${JSON.stringify({
            type: "thinking_delta",
            thinking: thinkingData,
          })}\n\n`,
        );
        controller.enqueue(thinkingDeltaEvent);
      } else if (thinkingData.type === "signature") {
        this.signature = thinkingData.signature;

        const signatureDeltaEvent = new TextEncoder().encode(
          `data: ${JSON.stringify({
            type: "signature_delta",
            signature: thinkingData.signature,
          })}\n\n`,
        );
        controller.enqueue(signatureDeltaEvent);
      }
    }

    const toolCallData = StreamingFormatter.extractToolCall(
      data,
      this.currentEventType,
    );
    if (toolCallData) {
      logger.debug("Detected tool call delta", { toolCallData });
    }

    if (toolCallData) {
      if (toolCallData.format === "openai") {
        const deltaToolCalls = toolCallData.toolCalls;

        for (const toolCall of deltaToolCalls) {
          const index = toolCall.index;

          if (!this.currentToolCalls[index]) {
            this.currentToolCalls[index] = {
              id: toolCall.id,
              type: toolCall.type || "function",
              function: {
                name: toolCall.function?.name || "",
                arguments: "",
              },
            };
          }

          if (toolCall.function) {
            if (toolCall.function.name) {
              this.currentToolCalls[index].function.name =
                toolCall.function.name;
            }
            if (toolCall.function.arguments) {
              this.currentToolCalls[index].function.arguments +=
                toolCall.function.arguments;
            }
          }
        }
      } else if (toolCallData.format === "anthropic") {
        this.currentToolCalls[toolCallData.index] = {
          id: toolCallData.id,
          name: toolCallData.name,
          accumulatedInput: "",
          isComplete: false,
        };
      } else if (toolCallData.format === "anthropic_delta") {
        if (
          this.currentToolCalls[toolCallData.index] &&
          toolCallData.partial_json
        ) {
          this.currentToolCalls[toolCallData.index].accumulatedInput +=
            toolCallData.partial_json;
        }
      } else if (toolCallData.format === "direct") {
        this.toolCallsData = [...this.toolCallsData, ...toolCallData.toolCalls];
      }
    }

    if (
      [
        "message_start",
        "message_delta",
        "message_stop",
        "content_block_start",
        "content_block_stop",
        "state",
        "usage_limits",
      ].includes(this.currentEventType)
    ) {
      const forwardEvent = new TextEncoder().encode(
        `data: ${JSON.stringify({
          type: this.currentEventType,
          ...data,
        })}\n\n`,
      );
      controller.enqueue(forwardEvent);

      if (
        this.currentEventType === "content_block_stop" &&
        data.index !== undefined &&
        Object.prototype.hasOwnProperty.call(
          this.currentToolCalls,
          data.index,
        ) &&
        this.currentToolCalls[data.index] &&
        !this.currentToolCalls[data.index].isComplete
      ) {
        this.currentToolCalls[data.index].isComplete = true;

        const toolState = this.currentToolCalls[data.index];
        let parsedInput = {};
        try {
          if (toolState.accumulatedInput) {
            parsedInput;
            try {
              parsedInput = JSON.parse(toolState.accumulatedInpu);
            } catch (e) {
              logger.error("Failed to parse tool input:", {
                error: e,
              });
            }

            if (
              parsedInput === null ||
              typeof parsedInput !== "object" ||
              Array.isArray(parsedInput)
            ) {
              logger.warn("Tool input parsed to non-object value", {
                toolId: toolState.id,
                toolName: toolState.name,
                parsed: typeof parsedInput,
              });
              parsedInput = {};
            }
          }
        } catch (e) {
          logger.error("Failed to parse tool input:", {
            error: e,
            toolId: toolState.id,
            toolName: toolState.name,
            input:
              toolState.accumulatedInput?.substring(0, 100) +
              (toolState.accumulatedInput?.length > 100 ? "..." : ""),
          });
        }

        const toolCall = {
          id: toolState.id,
          type: toolState.type || "function",
          function: {
            name: toolState.name,
            arguments: JSON.stringify(parsedInput),
          },
        };

        this.toolCallsData.push(toolCall);
      }
    }

    this.context?.setToolCalls(this.toolCallsData);

    const extractedCitations = StreamingFormatter.extractCitations(data);
    if (extractedCitations.length > 0) {
      this.citationsResponse = extractedCitations;
    }

    const extractedUsage = StreamingFormatter.extractUsageData(data);
    if (extractedUsage) {
      this.usageData = extractedUsage;
    }
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
    this.buffer = "";
    this.currentEventType = "";
    this.currentToolCalls = {};
    this.toolCallsData = [];
  }
}
