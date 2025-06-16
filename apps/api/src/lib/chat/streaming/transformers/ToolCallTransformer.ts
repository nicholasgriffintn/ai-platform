import { formatAssistantMessage } from "~/lib/chat/responses";
import { handleToolCalls } from "~/lib/chat/tools";
import type { ConversationManager } from "~/lib/conversationManager";
import { Guardrails } from "~/lib/guardrails";
import { MemoryManager } from "~/lib/memory";
import type { ChatMode, ContentType, MessageContent } from "~/types";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import type { StreamContext } from "../StreamContext";
import type { StreamTransformer } from "../StreamPipeline";
import type { StreamProcessorOptions } from "../StreamProcessor";

const logger = getLogger({ prefix: "TOOL_CALL_TRANSFORMER" });

export class ToolCallTransformer implements StreamTransformer {
  private toolCallsData: any[] = [];
  private currentToolCalls: Record<string, any> = {};
  private postProcessingDone = false;
  private context?: StreamContext;

  constructor(
    private options: StreamProcessorOptions,
    private conversationManager: ConversationManager,
  ) {}

  getName(): string {
    return "ToolCallTransformer";
  }

  async transform(
    stream: ReadableStream,
    context: StreamContext,
  ): Promise<ReadableStream> {
    this.context = context;
    return stream.pipeThrough(
      new TransformStream({
        start: (controller) => {
          logger.debug("Tool call transformer initialized", {
            completion_id: this.options.completion_id,
          });
        },

        transform: (chunk, controller) => {
          try {
            const text = new TextDecoder().decode(chunk);
            this.processChunk(text, controller);
          } catch (error) {
            logger.error("Error in tool call transformer", {
              error,
              completion_id: this.options.completion_id,
            });
          }
        },

        flush: async (controller) => {
          if (!this.postProcessingDone) {
            await this.handlePostProcessing(controller);
          }
        },
      }),
    );
  }

  private processChunk(
    text: string,
    controller: TransformStreamDefaultController,
  ): void {
    const lines = text.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.substring(6).trim());

          if (data.type === "tool_use_start") {
            this.handleToolStart(data, controller);
          } else if (data.type === "tool_use_delta") {
            this.handleToolDelta(data, controller);
          } else if (data.type === "tool_use_stop") {
            this.handleToolStop(data, controller);
          }
        } catch (error) {
          /* ignore errors */
        }
      }
    }

    controller.enqueue(new TextEncoder().encode(text));
  }

  private handleToolStart(
    data: any,
    controller: TransformStreamDefaultController,
  ): void {
    const toolCall = {
      id: data.tool_id,
      type: "function",
      function: {
        name: data.tool_name || "",
        arguments: "",
      },
    };

    this.currentToolCalls[data.tool_id] = toolCall;
    this.emitToolEvent(controller, toolCall, "start");
  }

  private handleToolDelta(
    data: any,
    controller: TransformStreamDefaultController,
  ): void {
    const toolCall = this.currentToolCalls[data.tool_id];
    if (toolCall && data.parameters) {
      toolCall.function.arguments += data.parameters;
      this.emitToolEvent(controller, toolCall, "delta", data.parameters);
    }
  }

  private handleToolStop(
    data: any,
    controller: TransformStreamDefaultController,
  ): void {
    const toolCall = this.currentToolCalls[data.tool_id];
    if (toolCall) {
      this.emitToolEvent(controller, toolCall, "stop");
    }
  }

  private async handlePostProcessing(
    controller: TransformStreamDefaultController,
  ): Promise<void> {
    try {
      if (this.postProcessingDone) return;

      this.emitEvent(controller, "state", { state: "post_processing" });
      this.postProcessingDone = true;

      if (
        Object.keys(this.currentToolCalls).length > 0 &&
        this.toolCallsData.length === 0
      ) {
        this.toolCallsData = Object.values(this.currentToolCalls);
      }

      await this.processMemories(controller);

      const guardrailsResult = await this.processGuardrails();

      await this.storeAssistantMessage(guardrailsResult);

      this.emitFinalEvents(controller, guardrailsResult);

      if (this.toolCallsData.length > 0) {
        await this.processToolCalls(controller);
      }
    } catch (error) {
      logger.error("Post-processing failed", {
        error,
        completion_id: this.options.completion_id,
      });

      this.emitEvent(controller, "error", {
        error: "Post-processing failed",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processMemories(
    controller: TransformStreamDefaultController,
  ): Promise<void> {
    const { user, userSettings, env, completion_id } = this.options;
    const isProUser = user?.plan_id === "pro";
    const memoriesEnabled =
      userSettings?.memories_save_enabled ||
      userSettings?.memories_chat_history_enabled;

    if (!isProUser || !memoriesEnabled) return;

    try {
      const history = await this.conversationManager.get(completion_id);
      const userHistory = history.filter((m) => m.role === "user");
      const lastUserRaw = userHistory.length
        ? userHistory[userHistory.length - 1].content
        : "";

      const lastUserText =
        typeof lastUserRaw === "string"
          ? lastUserRaw
          : Array.isArray(lastUserRaw)
            ? (lastUserRaw.find((b: any) => b.type === "text") as any)?.text ||
              ""
            : "";

      if (lastUserText.trim()) {
        const memMgr = MemoryManager.getInstance(env, user);
        const memEvents = await memMgr.handleMemory(
          lastUserText,
          history,
          this.conversationManager,
          completion_id,
          userSettings,
        );

        for (const ev of memEvents) {
          this.toolCallsData.push({
            id: generateId(),
            type: "function",
            function: {
              name: "memory",
              arguments: JSON.stringify(ev),
            },
          });
        }
      }
    } catch (error) {
      logger.error("Failed to process memory for chat", {
        error,
        completion_id,
      });
    }
  }

  private async processGuardrails(): Promise<{
    passed: boolean;
    error: string;
    violations: any[];
  }> {
    const { env, user, userSettings, completion_id } = this.options;

    const fullContent = this.context?.getContent() || "";

    if (!fullContent) {
      return { passed: true, error: "", violations: [] };
    }

    try {
      const guardrails = Guardrails.getInstance(env, user, userSettings);
      const outputValidation = await guardrails.validateOutput(
        fullContent,
        user?.id,
        completion_id,
      );

      return {
        passed: outputValidation.isValid,
        error: outputValidation.rawResponse?.blockedResponse || "",
        violations: outputValidation.violations || [],
      };
    } catch (error) {
      logger.error("Guardrails validation failed", { error, completion_id });
      return { passed: false, error: "Validation failed", violations: [] };
    }
  }

  private async storeAssistantMessage(guardrailsResult: any): Promise<void> {
    const { completion_id, model, platform = "api", mode, env } = this.options;

    const fullContent = this.context?.getContent() || "";
    const fullThinking = this.context?.getThinking() || "";
    const signature = this.context?.getSignature() || "";
    const citationsResponse = this.context?.getCitations() || [];
    const usageData = this.context?.getUsage();

    const assistantMessage = formatAssistantMessage({
      content: fullContent,
      thinking: fullThinking,
      signature: signature,
      citations: citationsResponse,
      tool_calls: this.toolCallsData,
      usage: usageData,
      guardrails: guardrailsResult,
      log_id: env.AI?.aiGatewayLogId,
      model,
      platform,
      timestamp: Date.now(),
      mode,
      finish_reason: this.toolCallsData.length > 0 ? "tool_calls" : "stop",
    });

    await this.conversationManager.add(completion_id, {
      role: "assistant",
      content:
        assistantMessage.thinking || assistantMessage.signature
          ? ([
              assistantMessage.thinking
                ? {
                    type: "thinking" as ContentType,
                    thinking: assistantMessage.thinking,
                    signature: assistantMessage.signature || "",
                  }
                : null,
              {
                type: "text" as ContentType,
                text: assistantMessage.content,
              },
            ].filter(Boolean) as MessageContent[])
          : assistantMessage.content,
      citations: assistantMessage.citations,
      log_id: assistantMessage.log_id,
      mode: assistantMessage.mode as ChatMode,
      id: assistantMessage.id,
      timestamp: assistantMessage.timestamp,
      model: assistantMessage.model,
      platform: assistantMessage.platform,
      usage: assistantMessage.usage,
      tool_calls: assistantMessage.tool_calls,
    });
  }

  private emitFinalEvents(
    controller: TransformStreamDefaultController,
    guardrailsResult: any,
  ): void {
    const { completion_id, model, env } = this.options;

    this.emitEvent(controller, "message_delta", {
      id: completion_id,
      object: "chat.completion",
      created: Date.now(),
      model: model,
      nonce: generateId(),
      post_processing: {
        guardrails: guardrailsResult,
      },
      log_id: env.AI?.aiGatewayLogId,
      usage: this.context?.getUsage(),
      citations: this.context?.getCitations() || [],
      finish_reason: this.toolCallsData.length > 0 ? "tool_calls" : "stop",
    });

    this.emitEvent(controller, "message_stop", {});
  }

  private async processToolCalls(
    controller: TransformStreamDefaultController,
  ): Promise<void> {
    const { completion_id, env, app_url, user, model } = this.options;

    for (const toolCall of this.toolCallsData) {
      this.emitToolEvent(controller, toolCall, "start");
      this.emitToolEvent(
        controller,
        toolCall,
        "delta",
        toolCall.function?.arguments || "{}",
      );
      this.emitToolEvent(controller, toolCall, "stop");
    }

    this.emitEvent(controller, "tool_response_start", {
      tool_calls: this.toolCallsData,
    });

    try {
      const toolResults = await handleToolCalls(
        completion_id,
        {
          response: this.context?.getContent() || "",
          tool_calls: this.toolCallsData,
        },
        this.conversationManager,
        {
          env,
          request: {
            completion_id,
            input: this.context?.getContent() || "",
            model,
            date: new Date().toISOString().split("T")[0],
          },
          app_url,
          user: user?.id ? user : undefined,
        },
      );

      for (const toolResult of toolResults) {
        this.emitEvent(controller, "tool_response", {
          tool_id: toolResult.id,
          content: toolResult.content,
        });
      }

      this.emitEvent(controller, "tool_response_stop", {});
    } catch (error) {
      logger.error("Tool call processing failed", {
        error,
        completion_id,
      });

      this.emitEvent(controller, "tool_error", {
        error: "Tool processing failed",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private emitToolEvent(
    controller: TransformStreamDefaultController,
    toolCall: any,
    stage: "start" | "delta" | "stop",
    data?: any,
  ): void {
    const eventType = `tool_use_${stage}`;
    const payload: Record<string, any> = {
      tool_id: toolCall.id,
    };

    if (stage === "start") {
      payload.tool_name = toolCall.function?.name || "";
    } else if (stage === "delta") {
      payload.parameters = data || "{}";
    }

    this.emitEvent(controller, eventType, payload);
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
}
