import type { ExecutionContext } from "@cloudflare/workers-types";
import type { AgentEvent } from "@ngriffin_uk/polychat-library-agent-core";
import type { ChatRunCommandReceipt } from "@ngriffin_uk/polychat-schemas";

import { runAgentLoop, type AgentLoopExecutionParams } from "~/lib/chat/agent/agent-loop";
import { isAgentExecutionMode } from "~/lib/chat/policy/mode-metadata";
import { createChatSseStreamWriter, startChatStreamHeartbeat } from "~/lib/chat/streaming/emitter";
import { watchTurnCancellation } from "~/lib/chat/streaming/turn-cancellation";
import { closeComposioConnectorRun } from "~/services/apps/connectors/composio-run";
import type { ChatRunLifecycle } from "~/services/chat-runs/lifecycle";
import { createChatRetryStatePublisher } from "~/services/chat-runs/retry-state";
import { disposeMCPClients } from "~/services/functions/mcp";
import { StreamState } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/core/chat-stream" });

export type CreateChatTurnStreamParams = Omit<AgentLoopExecutionParams, "sink" | "emit"> & {
  executionCtx?: ExecutionContext;
  onTurnEnd?: () => Promise<void>;
  runLifecycle?: ChatRunLifecycle | null;
};

export function createChatRunReceiptStream(receipt: ChatRunCommandReceipt): ReadableStream {
  const stream = createChatSseStreamWriter();

  void (async () => {
    try {
      await stream.writeEvent("state", { state: "run", receipt });
      await stream.writeDone();
      await stream.close();
    } catch (error) {
      await stream.abort(error);
    }
  })();

  return stream.readable;
}

export function createChatTurnStream(params: CreateChatTurnStreamParams): ReadableStream {
  const stream = createChatSseStreamWriter();
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
    try {
      if (params.runLifecycle) {
        await stream.writeEvent("state", {
          state: "run",
          receipt: params.runLifecycle.receipt,
        });
      }

      await stream.writeEvent("state", { state: StreamState.INIT });

      const usageLimits = await params.conversationManager.getUsageLimits();

      if (usageLimits) {
        await stream.writeEvent("usage_limits", { usage_limits: usageLimits });
      }

      const result = await runAgentLoop({
        ...params,
        sink: stream,
        shouldStop: stopSignal.shouldStop,
        onRetryState: createChatRetryStatePublisher({ sink: stream, runLifecycle }),
        emit: tracesAgentEvents
          ? async (event: AgentEvent) => {
              await stream.writeEvent("state", { state: "agent_event", event: { ...event } });
            }
          : undefined,
      });

      if (params.runLifecycle) {
        await params.runLifecycle.complete(result);
        await stream.writeEvent("state", {
          state: "run",
          receipt: params.runLifecycle.receipt,
        });
      }

      await stream.writeEvent("state", { state: StreamState.DONE });
    } catch (error) {
      logger.error("Chat turn stream failed", { error, completionId: params.completionId });

      if (params.runLifecycle) {
        try {
          await params.runLifecycle.fail(error);
          await stream.writeEvent("state", {
            state: "run",
            receipt: params.runLifecycle.receipt,
          });
        } catch (runError) {
          logger.error("Failed to record streamed run failure", {
            error: runError,
            runId: params.runLifecycle.run.id,
          });
        }
      }

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
