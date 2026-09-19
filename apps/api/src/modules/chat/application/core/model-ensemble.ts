import type { ExecutionContext } from "@cloudflare/workers-types";
import { userCreditActor, recordModelTurnUsage } from "@ngriffin_uk/polychat-ai-billing";
import {
  extractUsagePayload,
  normaliseTokenUsage,
  getLogger,
} from "@ngriffin_uk/polychat-ai-telemetry";
import type { ModelConfigInfo } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveTelemetryIdentity } from "~/infrastructure/telemetry";
import type { ChatRunLifecycle } from "~/modules/chat-runs/application/lifecycle";
import { createChatRetryStatePublisher } from "~/modules/chat-runs/application/retry-state";
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
import { createUsageRuntime } from "~/modules/usage/application/runtime";
import { StreamState, type Message } from "~/types";

const logger = getLogger({ prefix: "services/chat/core/model-ensemble" });

const SUPPRESSED_PRIMARY_EVENTS = new Set(["message_delta", "message_stop"]);

export type CreateModelEnsembleStreamParams = Omit<AgentLoopExecutionParams, "sink" | "emit"> & {
  models: ModelConfigInfo[];
  usageScopeId: string;
  executionCtx?: ExecutionContext;
  onTurnEnd?: () => Promise<void>;
  runLifecycle?: ChatRunLifecycle | null;
};

export function createModelEnsembleStream(params: CreateModelEnsembleStreamParams): ReadableStream {
  const startedAtMs = Date.now();
  const stream = createChatSseStreamWriter();
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

  const primarySink: ChatEventSink = {
    writeEvent: async (type, payload) => {
      if (SUPPRESSED_PRIMARY_EVENTS.has(type)) {
        return;
      }

      await stream.writeEvent(type, payload);
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
        await stream.writeEvent("state", {
          state: "run",
          receipt: params.runLifecycle.receipt,
        });
      }

      await writeTurnActivity(stream, { kind: "turn_started" });
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
        onRetryState: createChatRetryStatePublisher({
          sink: primarySink,
          runLifecycle,
        }),
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
        provenance: merged.provenance,
        usage: merged.usage,
        citations: merged.citations,
        data: merged.data,
        parts: merged.parts,
        finish_reason: "stop",
      });
      await stream.writeEvent("message_stop", {});
      if (params.runLifecycle) {
        await params.runLifecycle.complete(primary);
        await stream.writeEvent("state", {
          state: "run",
          receipt: params.runLifecycle.receipt,
        });
      }

      await writeTurnActivity(stream, { kind: "turn_finished", outcome });
      await stream.writeEvent("state", { state: StreamState.DONE });

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
          await stream.writeEvent("state", {
            state: "run",
            receipt: params.runLifecycle.receipt,
          });
        } catch (runError) {
          logger.error("Failed to record model ensemble run failure", {
            error: runError,
            runId: params.runLifecycle.run.id,
          });
        }
      }

      await writeTurnActivity(stream, { kind: "turn_finished", outcome: "failed" });
      await stream.writeEvent("error", {
        error: {
          message: error instanceof Error ? error.message : "Failed to complete the response",
        },
        type: error instanceof AssistantError ? error.type : ErrorType.PROVIDER_ERROR,
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
