import type { ExecutionContext } from "@cloudflare/workers-types";
import type { ModelConfigInfo } from "@ngriffin_uk/polychat-schemas";

import { runAgentLoop, type AgentLoopExecutionParams } from "~/lib/chat/agent/agent-loop";
import { createRunResourceCloser } from "~/lib/chat/core/chat-stream";
import {
  createChatSseStreamWriter,
  startChatStreamHeartbeat,
  type ChatEventSink,
} from "~/lib/chat/streaming/emitter";
import { getAIResponse } from "~/lib/chat/streaming/responses";
import { watchDetachedTurnCancellation } from "~/lib/chat/streaming/turn-cancellation";
import { extractUsagePayload } from "~/lib/usage/extractUsage";
import { recordModelTurnUsage } from "~/lib/usage/modelUsage";
import { normaliseTokenUsage } from "~/lib/usage/tokenUsage";
import { StreamState, type Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/core/model-ensemble" });

const SUPPRESSED_PRIMARY_EVENTS = new Set(["message_delta", "message_stop"]);

export type CreateModelEnsembleStreamParams = Omit<AgentLoopExecutionParams, "sink" | "emit"> & {
  models: ModelConfigInfo[];
  usageScopeId: string;
  executionCtx?: ExecutionContext;
  onTurnEnd?: () => Promise<void>;
};

export function createModelEnsembleStream(params: CreateModelEnsembleStreamParams): ReadableStream {
  const stream = createChatSseStreamWriter();
  const closeRunResources = createRunResourceCloser(params);
  const stopHeartbeat = startChatStreamHeartbeat(stream);
  const stopSignal = watchDetachedTurnCancellation({
    env: params.env,
    completionId: params.completionId,
    isDetached: stream.isDetached,
  });
  const secondaryModels = params.models.slice(1);
  const secondaryResponses = secondaryModels.map((modelConfig, index) =>
    requestSecondaryAnswer(params, modelConfig, index),
  );

  const primarySink: ChatEventSink = {
    writeEvent: async (type, payload) => {
      if (SUPPRESSED_PRIMARY_EVENTS.has(type)) {
        return;
      }

      await stream.writeEvent(type, payload);
    },
  };

  const run = async () => {
    try {
      await stream.writeEvent("state", { state: StreamState.INIT });

      const usageLimits = await params.conversationManager.getUsageLimits();

      if (usageLimits) {
        await stream.writeEvent("usage_limits", { usage_limits: usageLimits });
      }

      const header = `Using the following models: ${params.models
        .map((modelConfig) => modelConfig.displayName)
        .join(", ")}\n\n`;

      await stream.writeEvent("content_block_delta", { content: header });

      const primary = await runAgentLoop({
        ...params,
        sink: primarySink,
        shouldStop: stopSignal.shouldStop,
      });
      const secondaryText = await streamSecondaryAnswers(
        stream,
        secondaryModels,
        secondaryResponses,
      );

      const merged = await mergeStoredAnswer({
        params,
        primaryMessage: primary.finalMessage,
        content: `${header}${asText(primary.finalMessage)}${secondaryText}`,
        secondaryModels,
      });

      await stream.writeEvent("message_delta", {
        id: params.completionId,
        message_id: merged.id,
        object: "chat.completion",
        created: merged.timestamp,
        model: merged.model,
        provider: params.provider,
        platform: merged.platform,
        usage: merged.usage,
        citations: merged.citations,
        data: merged.data,
        parts: merged.parts,
        finish_reason: "stop",
      });
      await stream.writeEvent("message_stop", {});
      await stream.writeEvent("state", { state: StreamState.DONE });
    } catch (error) {
      logger.error("Model ensemble stream failed", { error, completionId: params.completionId });

      await stream.writeEvent("error", {
        error: {
          message: error instanceof Error ? error.message : "Failed to complete the response",
        },
        type: error instanceof AssistantError ? error.type : ErrorType.PROVIDER_ERROR,
      });
    } finally {
      stopHeartbeat();
      stopSignal.stop();
      await params.conversationManager.releaseTurnReservation();
      await closeRunResources();

      try {
        await params.onTurnEnd?.();
      } catch (error) {
        logger.error("Failed to finalise the turn", {
          error,
          completionId: params.completionId,
        });
      }

      try {
        await stream.writeDone();
        await stream.close();
      } catch (error) {
        logger.error("Failed to close the model ensemble stream", { error });
      }
    }
  };

  const running = run().catch(async (error) => {
    logger.error("Model ensemble runner crashed", { error, completionId: params.completionId });
    stopHeartbeat();
    stopSignal.stop();
    await stream.abort(error);
  });

  params.executionCtx?.waitUntil(running);

  return stream.readable;
}

async function requestSecondaryAnswer(
  params: CreateModelEnsembleStreamParams,
  modelConfig: ModelConfigInfo,
  index: number,
): Promise<string> {
  try {
    const response = await getAIResponse({
      ...params.requestParams,
      model: modelConfig.model,
      provider: modelConfig.provider,
      stream: false,
      disable_functions: true,
      enabled_tools: [],
      tools: undefined,
    });

    if (response instanceof ReadableStream) {
      throw new AssistantError(
        "A secondary model returned a stream for a buffered request",
        ErrorType.PROVIDER_ERROR,
      );
    }

    const rawUsage = extractUsagePayload(response);

    await recordModelTurnUsage({
      env: params.env,
      repositories: params.context?.repositories,
      userId: params.context?.user?.id,
      usage: normaliseTokenUsage(rawUsage),
      rawUsage,
      model: modelConfig.model,
      provider: modelConfig.provider,
      completionId: params.completionId,
      messageId: `ensemble:${params.usageScopeId}:${index}:${modelConfig.model}`,
      conversationId: params.completionId,
    });

    return response.response || "";
  } catch (error) {
    logger.error("Secondary model failed", { error, model: modelConfig.model });

    return "";
  }
}

async function streamSecondaryAnswers(
  sink: ChatEventSink,
  secondaryModels: ModelConfigInfo[],
  responses: Promise<string>[],
): Promise<string> {
  let combined = "";

  for (const [index, response] of responses.entries()) {
    const modelName = secondaryModels[index]?.displayName || "Secondary model";
    const answer = await response;
    const section = answer
      ? `\n\n***\n### ${modelName} response\n\n${answer}`
      : `\n\n***\n### ${modelName} response\n\nThis model did not return an answer.`;

    combined += section;
    await sink.writeEvent("content_block_delta", { content: section });
  }

  return combined;
}

function asText(message?: Message): string {
  if (!message) {
    return "";
  }

  if (typeof message.content === "string") {
    return message.content;
  }

  return (
    (message.content as { type?: string; text?: string }[]).find((part) => part.type === "text")
      ?.text ?? ""
  );
}

async function mergeStoredAnswer({
  params,
  primaryMessage,
  content,
  secondaryModels,
}: {
  params: CreateModelEnsembleStreamParams;
  primaryMessage?: Message;
  content: string;
  secondaryModels: ModelConfigInfo[];
}): Promise<Message> {
  const merged: Message = {
    ...primaryMessage,
    role: "assistant",
    content,
    parts: [{ type: "text", text: content, timestamp: primaryMessage?.timestamp ?? Date.now() }],
    data: {
      ...primaryMessage?.data,
      includesSecondaryModels: true,
      secondaryModels: secondaryModels.map((modelConfig) => modelConfig.model),
    },
  };

  try {
    const conversation = await params.conversationManager.get(params.completionId);
    const primaryMessageId = primaryMessage?.id;
    const targetIndex = primaryMessageId
      ? conversation.findIndex((message) => message.id === primaryMessageId)
      : -1;

    if (targetIndex === -1) {
      logger.error("Could not find the primary message to merge the combined model answers into", {
        completionId: params.completionId,
        primaryMessageId: primaryMessageId ?? null,
        storedMessages: conversation.length,
        secondaryModels: secondaryModels.map((modelConfig) => modelConfig.model),
      });

      return merged;
    }

    const replaced = conversation.map((message, index) =>
      index === targetIndex ? merged : message,
    );

    await params.conversationManager.update(params.completionId, replaced);
  } catch (error) {
    logger.error("Failed to store the combined model answers", {
      error,
      completionId: params.completionId,
    });
  }

  return merged;
}
