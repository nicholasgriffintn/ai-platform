import type { ExecutionContext } from "@cloudflare/workers-types";
import { userCreditActor, recordModelTurnUsage } from "@ngriffin_uk/polychat-ai-billing";
import {
  extractUsagePayload,
  normaliseTokenUsage,
  getLogger,
} from "@ngriffin_uk/polychat-ai-telemetry";
import {
  assistantMessageAddedEvent,
  assistantMessageDoneEvent,
  responseReceiptEvent,
  type ModelConfigInfo,
  type ResponseEventInput,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveTelemetryIdentity } from "~/infrastructure/telemetry";
import {
  runAgentLoop,
  type AgentLoopExecutionParams,
} from "~/modules/chat/application/agent/agent-loop";
import { createRunResourceCloser } from "~/modules/chat/application/core/chat-stream";
import {
  recordTurnContinuityFinished,
  type TurnContinuityOutcome,
} from "~/modules/chat/application/streaming/continuity-telemetry";
import {
  createChatSseStreamWriter,
  startChatStreamHeartbeat,
  type ChatEventSink,
} from "~/modules/chat/application/streaming/emitter";
import { getAIResponse } from "~/modules/chat/application/streaming/responses";
import { writeTurnActivity } from "~/modules/chat/application/streaming/turn-activity";
import { watchTurnCancellation } from "~/modules/chat/application/streaming/turn-cancellation";
import { createChatContextPublisher } from "~/modules/responses/application/runs/context-state";
import type { ChatRunLifecycle } from "~/modules/responses/application/runs/lifecycle";
import { createChatRetryStatePublisher } from "~/modules/responses/application/runs/retry-state";
import { createUsageRuntime } from "~/modules/usage/application/runtime";
import type { Message } from "~/types";

const logger = getLogger({ prefix: "services/chat/core/model-ensemble" });

function isPrimaryMessageCompletion(event: ResponseEventInput): boolean {
  return (
    event.type === "response.content_part.done" ||
    (event.type === "response.output_item.done" && event.item.type === "message")
  );
}

export type CreateModelEnsembleStreamParams = Omit<AgentLoopExecutionParams, "sink" | "emit"> & {
  models: ModelConfigInfo[];
  usageScopeId: string;
  executionCtx?: ExecutionContext;
  onTurnEnd?: () => Promise<void>;
  runLifecycle?: ChatRunLifecycle | null;
  preludeEvents?: ResponseEventInput[];
};

export function createModelEnsembleStream(params: CreateModelEnsembleStreamParams): ReadableStream {
  const startedAtMs = Date.now();
  const stream = createChatSseStreamWriter({
    conversationId: params.completionId,
    responseId: params.runLifecycle?.run.id,
  });
  const closeRunResources = createRunResourceCloser(params);
  const stopHeartbeat = startChatStreamHeartbeat(stream);
  const runLifecycle = params.runLifecycle;
  const stopSignal = watchTurnCancellation({
    env: params.env,
    completionId: params.completionId,
    isDetached: stream.isDetached,
    isRunCancellationRequested: runLifecycle
      ? () => runLifecycle.isCancellationRequested()
      : undefined,
  });
  const secondaryModels = params.models.slice(1);
  const secondaryResponses = secondaryModels.map((modelConfig, index) =>
    requestSecondaryAnswer(params, modelConfig, index),
  );

  const messageId = generateId();
  const primarySink: ChatEventSink = {
    write: async (event) => {
      if (!isPrimaryMessageCompletion(event)) {
        await stream.write(event);
      }
    },
  };

  const run = async () => {
    let outcome: TurnContinuityOutcome = "failed";
    let visibleStreamClosed = false;
    let postTurn: (() => Promise<unknown>) | undefined;

    const closeVisibleStream = async () => {
      if (visibleStreamClosed) {
        return;
      }

      visibleStreamClosed = true;
      stopHeartbeat();

      try {
        await stream.writeDone();
        await stream.close();
      } catch (error) {
        logger.error("Failed to close the model ensemble stream", { error });
      }
    };

    let turnReleased = false;

    const releaseTurn = async () => {
      if (turnReleased) {
        return;
      }

      turnReleased = true;
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
    };

    try {
      if (params.runLifecycle) {
        await stream.write(responseReceiptEvent(params.runLifecycle.receipt));
      }

      await writeTurnActivity(stream, { kind: "turn_started" });
      await stream.write({ type: "response.phase", phase: "init" });

      for (const prelude of params.preludeEvents ?? []) {
        await stream.write(prelude);
      }

      const usageLimits = await params.conversationManager.getUsageLimits();

      if (usageLimits) {
        await stream.write({
          type: "response.usage_limits",
          usage_limits: usageLimits,
        });
      }

      const header = `Using the following models: ${params.models
        .map((modelConfig) => modelConfig.displayName)
        .join(", ")}\n\n`;

      await stream.write(
        assistantMessageAddedEvent(messageId, {
          created: Date.now(),
          model: params.model,
          provider: params.provider,
          platform: params.platform,
        }),
      );
      await stream.write({ type: "response.output_text.delta", item_id: messageId, delta: header });

      const primary = await runAgentLoop({
        ...params,
        openedMessageId: messageId,
        sink: primarySink,
        shouldStop: stopSignal.shouldStop,
        onRetryState: createChatRetryStatePublisher({
          sink: primarySink,
          runLifecycle,
        }),
        onContextSnapshot:
          createChatContextPublisher({ sink: primarySink, runLifecycle }) ??
          params.onContextSnapshot,
      });

      postTurn = primary.postTurn;

      outcome =
        primary.response.status === "pending"
          ? "waiting"
          : primary.response.status === "stopped"
            ? "cancelled"
            : primary.response.status === "incomplete"
              ? "failed"
              : "completed";
      const secondaryText = await streamSecondaryAnswers(
        stream,
        messageId,
        secondaryModels,
        secondaryResponses,
      );

      const merged = await mergeStoredAnswer({
        params,
        primaryMessage: primary.finalMessage,
        content: `${header}${asText(primary.finalMessage)}${secondaryText}`,
        secondaryModels,
      });

      await stream.write(
        assistantMessageDoneEvent(
          {
            id: merged.id ?? messageId,
            created: merged.timestamp,
            model: merged.model,
            provider: params.provider,
            platform: merged.platform,
            provenance: merged.provenance,
            usage: merged.usage,
            citations: merged.citations,
            data: merged.data,
            parts: merged.parts,
          },
          "stop",
        ),
      );
      await stream.write({ type: "response.content_part.done", item_id: merged.id ?? messageId });
      if (params.runLifecycle) {
        await params.runLifecycle.complete(primary);
        await stream.write(responseReceiptEvent(params.runLifecycle.receipt));
      }

      await writeTurnActivity(stream, { kind: "turn_finished", outcome });
      await stream.write({ type: "response.phase", phase: "done" });

      await closeVisibleStream();
      await releaseTurn();

      try {
        await postTurn?.();
      } catch (error) {
        logger.error("Failed to finish model ensemble post-turn work", {
          error,
          completionId: params.completionId,
        });
      }
    } catch (error) {
      logger.error("Model ensemble stream failed", { error, completionId: params.completionId });

      if (params.runLifecycle) {
        try {
          await params.runLifecycle.fail(error);
          await stream.write(responseReceiptEvent(params.runLifecycle.receipt));
        } catch (runError) {
          logger.error("Failed to record model ensemble run failure", {
            error: runError,
            runId: params.runLifecycle.run.id,
          });
        }
      }

      await writeTurnActivity(stream, { kind: "turn_finished", outcome: "failed" });
      await stream.write({
        type: "response.error",
        error: {
          message: error instanceof Error ? error.message : "Failed to complete the response",
        },
        code: error instanceof AssistantError ? error.type : ErrorType.PROVIDER_ERROR,
      });

      await closeVisibleStream();
    } finally {
      await releaseTurn();
      await closeVisibleStream();

      recordTurnContinuityFinished(
        {
          env: params.env,
          executionCtx: params.executionCtx,
          traceId: params.completionId,
          identity: resolveTelemetryIdentity(params.context),
        },
        {
          platform: params.platform,
          outcome,
          startedAtMs,
          finishedAtMs: Date.now(),
          stream: stream.getContinuitySnapshot(),
          cancellationObserved: stopSignal.wasCancellationObserved(),
        },
      );
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

    await recordModelTurnUsage(
      createUsageRuntime({ env: params.env, repositories: params.context?.repositories }),
      {
        actor: params.context?.user?.id ? userCreditActor(params.context.user.id) : null,
        usage: normaliseTokenUsage(rawUsage),
        rawUsage,
        model: modelConfig.model,
        provider: modelConfig.provider,
        completionId: params.completionId,
        messageId: `ensemble:${params.usageScopeId}:${index}:${modelConfig.model}`,
        conversationId: params.completionId,
        runId: params.runId ?? null,
        runAttempt: params.runAttempt ?? null,
        provenance: params.provenance
          ? {
              ...params.provenance,
              model: modelConfig.model,
              vendor: modelConfig.provider,
            }
          : undefined,
      },
    );

    return response.response || "";
  } catch (error) {
    logger.error("Secondary model failed", { error, model: modelConfig.model });

    return "";
  }
}

async function streamSecondaryAnswers(
  sink: ChatEventSink,
  messageId: string,
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
    await sink.write({ type: "response.output_text.delta", item_id: messageId, delta: section });
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
