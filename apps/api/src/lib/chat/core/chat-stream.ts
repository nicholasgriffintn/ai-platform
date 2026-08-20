import type { ExecutionContext } from "@cloudflare/workers-types";
import type { AgentEvent } from "@ngriffin_uk/polychat-library-agent-core";

import { runAgentLoop, type AgentLoopExecutionParams } from "~/lib/chat/agent/runAgentLoop";
import { createChatSseStreamWriter, startChatStreamHeartbeat } from "~/lib/chat/emitter";
import { isAgentExecutionMode } from "~/lib/chat/mode-metadata";
import { watchDetachedTurnCancellation } from "~/lib/chat/turn-cancellation";
import { closeComposioConnectorRun } from "~/services/apps/connectors/composio-run";
import { StreamState } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/core/chat-stream" });

export type CreateChatTurnStreamParams = Omit<AgentLoopExecutionParams, "sink" | "emit"> & {
  executionCtx?: ExecutionContext;
};

export function createChatTurnStream(params: CreateChatTurnStreamParams): ReadableStream {
  const stream = createChatSseStreamWriter();
  const tracesAgentEvents = isAgentExecutionMode(params.mode);
  const closeConnectorRun = createConnectorRunCloser(params);
  const stopHeartbeat = startChatStreamHeartbeat(stream);
  const stopSignal = watchDetachedTurnCancellation({
    env: params.env,
    completionId: params.completionId,
    isDetached: stream.isDetached,
  });

  const run = async () => {
    try {
      await stream.writeEvent("state", { state: StreamState.INIT });

      const usageLimits = await params.conversationManager.getUsageLimits();

      if (usageLimits) {
        await stream.writeEvent("usage_limits", { usage_limits: usageLimits });
      }

      await runAgentLoop({
        ...params,
        sink: stream,
        shouldStop: stopSignal.shouldStop,
        emit: tracesAgentEvents
          ? async (event: AgentEvent) => {
              await stream.writeEvent("state", { state: "agent_event", event: { ...event } });
            }
          : undefined,
      });

      await stream.writeEvent("state", { state: StreamState.DONE });
    } catch (error) {
      logger.error("Chat turn stream failed", { error, completionId: params.completionId });

      await stream.writeEvent("error", {
        error: {
          message: error instanceof Error ? error.message : "Failed to complete the response",
        },
        type: error instanceof AssistantError ? error.type : ErrorType.PROVIDER_ERROR,
      });
    } finally {
      stopHeartbeat();
      stopSignal.stop();
      await closeConnectorRun();

      try {
        await stream.writeDone();
        await stream.close();
      } catch (error) {
        logger.error("Failed to close the chat turn stream", { error });
      }
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

export function createConnectorRunCloser(params: {
  toolRequestContext: AgentLoopExecutionParams["toolRequestContext"];
}): () => Promise<void> {
  let closed: Promise<void> | undefined;

  return () => {
    const context = params.toolRequestContext.context;

    if (!context) {
      return Promise.resolve();
    }

    closed ??= Promise.resolve(closeComposioConnectorRun(context)).catch((error) => {
      logger.error("Failed to close the connector run", { error });
    });

    return closed;
  };
}
