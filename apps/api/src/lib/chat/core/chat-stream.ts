import type { ExecutionContext } from "@cloudflare/workers-types";
import type { AgentEvent } from "@ngriffin_uk/polychat-library-agent-core";

import { runAgentLoop, type AgentLoopExecutionParams } from "~/lib/chat/agent/agent-loop";
import { isAgentExecutionMode } from "~/lib/chat/policy/mode-metadata";
import {
  recordTurnContinuityFinished,
  type TurnContinuityOutcome,
} from "~/lib/chat/streaming/continuity-telemetry";
import { createChatSseStreamWriter, startChatStreamHeartbeat } from "~/lib/chat/streaming/emitter";
import { writeTurnActivity } from "~/lib/chat/streaming/turn-activity";
import { watchDetachedTurnCancellation } from "~/lib/chat/streaming/turn-cancellation";
import { closeComposioConnectorRun } from "~/services/apps/connectors/composio-run";
import { disposeMCPClients } from "~/services/functions/mcp";
import { StreamState } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/core/chat-stream" });

export type CreateChatTurnStreamParams = Omit<AgentLoopExecutionParams, "sink" | "emit"> & {
  executionCtx?: ExecutionContext;
  onTurnEnd?: () => Promise<void>;
};

export function createChatTurnStream(params: CreateChatTurnStreamParams): ReadableStream {
  const startedAtMs = Date.now();
  const stream = createChatSseStreamWriter();
  const tracesAgentEvents = isAgentExecutionMode(params.mode);
  const closeRunResources = createRunResourceCloser(params);
  const stopHeartbeat = startChatStreamHeartbeat(stream);
  const stopSignal = watchDetachedTurnCancellation({
    env: params.env,
    completionId: params.completionId,
    isDetached: stream.isDetached,
  });

  const run = async () => {
    let outcome: TurnContinuityOutcome = "failed";

    try {
      await writeTurnActivity(stream, { kind: "turn_started" });
      await stream.writeEvent("state", { state: StreamState.INIT });

      const usageLimits = await params.conversationManager.getUsageLimits();

      if (usageLimits) {
        await stream.writeEvent("usage_limits", { usage_limits: usageLimits });
      }

      const result = await runAgentLoop({
        ...params,
        sink: stream,
        shouldStop: stopSignal.shouldStop,
        emit: tracesAgentEvents
          ? async (event: AgentEvent) => {
              await stream.writeEvent("state", { state: "agent_event", event: { ...event } });
            }
          : undefined,
      });

      outcome =
        result.response.status === "pending"
          ? "waiting"
          : result.response.status === "stopped"
            ? "cancelled"
            : result.response.status === "incomplete"
              ? "failed"
              : "completed";

      await writeTurnActivity(stream, { kind: "turn_finished", outcome });
      await stream.writeEvent("state", { state: StreamState.DONE });
    } catch (error) {
      logger.error("Chat turn stream failed", { error, completionId: params.completionId });

      await writeTurnActivity(stream, {
        kind: "turn_finished",
        outcome: "failed",
        errorType: error instanceof AssistantError ? error.type : ErrorType.PROVIDER_ERROR,
      });
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
        logger.error("Failed to close the chat turn stream", { error });
      }

      recordTurnContinuityFinished(
        {
          env: params.env,
          executionCtx: params.executionCtx,
          traceId: params.completionId,
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

      await disposeMCPClients(context);
    })();

    return closed;
  };
}
