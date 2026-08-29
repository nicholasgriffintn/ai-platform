import type { ExecutionContext } from "@cloudflare/workers-types";
import type { AgentEvent } from "@ngriffin_uk/polychat-library-agent-core";

import { runAgentLoop, type AgentLoopExecutionParams } from "~/lib/chat/agent/agent-loop";
import { isAgentExecutionMode } from "~/lib/chat/policy/mode-metadata";
import { createChatSseStreamWriter, startChatStreamHeartbeat } from "~/lib/chat/streaming/emitter";
import { watchDetachedTurnCancellation } from "~/lib/chat/streaming/turn-cancellation";
import { closeComposioConnectorRun } from "~/services/apps/connectors/composio-run";
import { disposeMCPClients } from "~/services/functions/mcp";
import { StreamState } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/core/chat-stream" });

export type CreateChatTurnStreamParams = Omit<AgentLoopExecutionParams, "sink" | "emit"> & {
  executionCtx?: ExecutionContext;
  /**
   * Runs when the turn ends, not when the client stops reading. A detached
   * turn keeps writing to the conversation, so whatever it holds — the thread
   * lock above all — has to be released on this hook rather than on cancel.
   */
  onTurnEnd?: () => Promise<void>;
};

export function createChatTurnStream(params: CreateChatTurnStreamParams): ReadableStream {
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
