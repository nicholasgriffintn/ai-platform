import type { ExecutionContext } from "@cloudflare/workers-types";
import type { AgentEvent } from "@ngriffin_uk/polychat-ai-agents";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  isAgentExecutionMode,
  responseReceiptEvent,
  type ChatRunCommandReceipt,
  type ResponseEventInput,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { resolveTelemetryIdentity } from "~/infrastructure/telemetry";
import { closeComposioConnectorRun } from "~/modules/connectors/application/composio-run";
import {
  runAgentLoop,
  type AgentLoopExecutionParams,
} from "~/modules/responses/application/engine/agent/agent-loop";
import {
  recordTurnContinuityFinished,
  type TurnContinuityOutcome,
} from "~/modules/responses/application/engine/streaming/continuity-telemetry";
import {
  createChatSseStreamWriter,
  startChatStreamHeartbeat,
} from "~/modules/responses/application/engine/streaming/emitter";
import { writeTurnActivity } from "~/modules/responses/application/engine/streaming/turn-activity";
import { watchTurnCancellation } from "~/modules/responses/application/engine/streaming/turn-cancellation";
import { createChatContextPublisher } from "~/modules/responses/application/runs/context-state";
import type { ChatRunLifecycle } from "~/modules/responses/application/runs/lifecycle";
import { createPartialCheckpointSink } from "~/modules/responses/application/runs/partial-checkpoint";
import { createChatRetryStatePublisher } from "~/modules/responses/application/runs/retry-state";
import { releaseTeammateComputerAgentLease } from "~/modules/teammates/application/computers";

const logger = getLogger({ prefix: "services/chat/core/chat-stream" });

export type CreateChatTurnStreamParams = Omit<AgentLoopExecutionParams, "sink" | "emit"> & {
  executionCtx?: ExecutionContext;
  onTurnEnd?: () => Promise<void>;
  runLifecycle?: ChatRunLifecycle | null;
  preludeEvents?: ResponseEventInput[];
};

export function createChatRunReceiptStream(receipt: ChatRunCommandReceipt): ReadableStream {
  const stream = createChatSseStreamWriter({
    conversationId: receipt.run.conversationId,
    responseId: receipt.run.id,
  });

  void (async () => {
    try {
      await stream.write(responseReceiptEvent(receipt));
      await stream.writeDone();
      await stream.close();
    } catch (error) {
      await stream.abort(error);
    }
  })();

  return stream.readable;
}

export function createChatTurnStream(params: CreateChatTurnStreamParams): ReadableStream {
  const startedAtMs = Date.now();
  const stream = createChatSseStreamWriter({
    conversationId: params.completionId,
    responseId: params.runLifecycle?.run.id,
  });
  const tracesAgentEvents = isAgentExecutionMode(params.mode);
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

  const run = async () => {
    let outcome: TurnContinuityOutcome = "failed";
    let visibleStreamClosed = false;

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
        logger.error("Failed to close the chat turn stream", { error });
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

      const result = await runAgentLoop({
        ...params,
        sink: runLifecycle
          ? createPartialCheckpointSink(stream, (content) =>
              runLifecycle.checkpointPartialContent(content),
            )
          : stream,
        shouldStop: stopSignal.shouldStop,
        onRetryState: createChatRetryStatePublisher({ sink: stream, runLifecycle }),
        onContextSnapshot:
          createChatContextPublisher({ sink: stream, runLifecycle }) ?? params.onContextSnapshot,
        emit: tracesAgentEvents
          ? async (event: AgentEvent) => {
              await stream.write({ type: "response.agent_event", event: { ...event } });
            }
          : undefined,
      });

      if (params.runLifecycle) {
        await params.runLifecycle.complete(result);
        await stream.write(responseReceiptEvent(params.runLifecycle.receipt));
      }

      outcome =
        result.response.status === "pending"
          ? "waiting"
          : result.response.status === "stopped"
            ? "cancelled"
            : result.response.status === "incomplete"
              ? "failed"
              : "completed";

      await writeTurnActivity(stream, { kind: "turn_finished", outcome });
      await stream.write({ type: "response.phase", phase: "done" });

      await closeVisibleStream();
      await releaseTurn();

      try {
        await result.postTurn?.();
      } catch (error) {
        logger.error("Failed to finish post-turn work", {
          error,
          completionId: params.completionId,
        });
      }
    } catch (error) {
      logger.error("Chat turn stream failed", { error, completionId: params.completionId });

      if (params.runLifecycle) {
        try {
          await params.runLifecycle.fail(error);
          await stream.write(responseReceiptEvent(params.runLifecycle.receipt));
        } catch (runError) {
          logger.error("Failed to record streamed run failure", {
            error: runError,
            runId: params.runLifecycle.run.id,
          });
        }
      }

      await writeTurnActivity(stream, {
        kind: "turn_finished",
        outcome: "failed",
        errorType: error instanceof AssistantError ? error.type : ErrorType.PROVIDER_ERROR,
      });
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
    logger.error("Chat turn stream runner crashed", { error, completionId: params.completionId });
    stopHeartbeat();
    stopSignal.stop();
    await stream.abort(error);
  });

  params.executionCtx?.waitUntil(running);

  return stream.readable;
}

export function createRunResourceCloser(params: {
  toolRequestContext: AgentLoopExecutionParams["toolRequestContext"];
}): () => Promise<void> {
  let closed: Promise<void> | undefined;

  return () => {
    const context = params.toolRequestContext.context;

    if (!context) {
      return Promise.resolve();
    }

    closed ??= (async () => {
      try {
        await closeComposioConnectorRun(context);
      } catch (error) {
        logger.error("Failed to close the connector run", { error });
      }

      const contextId = params.toolRequestContext.request?.teammate_context_id;

      if (contextId && context.executionRunId) {
        await releaseTeammateComputerAgentLease({
          context,
          contextId,
          runId: context.executionRunId,
        });
      }
    })();

    return closed;
  };
}
