import {
  isTerminalAgentHostRunStatus,
  type AgentHostRunRequest,
  type AgentHostRunSnapshot,
  type AgentHostRunUsage,
} from "@ngriffin_uk/polychat-schemas";
import { abortableDelay, generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { createInternalServiceDelegationToken } from "@ngriffin_uk/polychat-utility-server/internal-service-auth";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireActiveExecutionRun } from "~/modules/chat-runs/application/execution-authority";

import type { AgentHostClient } from "./AgentHostClient";
import type { AgentHostSpec } from "./agentHostSpec";
import {
  createAgentRunProgress,
  followAgentRunEvents,
  type AgentRunProgress,
} from "./hostedAgentEvents";
import { buildHostedAgentInstructions, truncateAgentInput } from "./hostedAgentInput";
import { maybeSteerQueuedFollowUp, replayPendingSteer } from "./hostedAgentSteer";

const RUN_POLL_INITIAL_MS = 1000;
const RUN_POLL_MAX_MS = 5000;
const RUN_MAX_DURATION_MS = 10 * 60 * 1000;
const SERVICE_TOKEN_REFRESH_MS = 8 * 60 * 1000;
const STEER_CHECK_INTERVAL_MS = 10_000;

export interface HostedAgentTurnResult {
  runId: string;
  output: string;
  approval?: NonNullable<AgentHostRunSnapshot["approval"]>;
  usage?: AgentHostRunUsage;
  sessionId?: string;
  runtime?: NonNullable<AgentHostRunSnapshot["runtime"]>;
  toolsUsed?: string[];
  subagentCompletions?: number;
}

export function hostedAgentHostId(spec: AgentHostSpec, userId: number): string {
  return `${spec.hostIdPrefix}-${userId}`;
}

export function hostedAgentSessionId(spec: AgentHostSpec, conversationId: string): string {
  return `${spec.sessionIdPrefix}-${conversationId.replace(/[^A-Za-z0-9_-]/gu, "-")}`.slice(0, 160);
}

function nextPollDelay(currentMs: number): number {
  return Math.min(RUN_POLL_MAX_MS, Math.ceil(currentMs * 1.5));
}

function toTurnResult(
  spec: AgentHostSpec,
  snapshot: AgentHostRunSnapshot,
  runId: string,
  progress: AgentRunProgress,
): HostedAgentTurnResult {
  const activity =
    progress.toolsUsed.length > 0 || progress.subagentCompletions > 0
      ? {
          ...(progress.toolsUsed.length > 0 ? { toolsUsed: [...progress.toolsUsed] } : {}),
          ...(progress.subagentCompletions > 0
            ? { subagentCompletions: progress.subagentCompletions }
            : {}),
        }
      : {};

  if (snapshot.status === "waiting_for_approval") {
    if (!snapshot.approval) {
      throw new AssistantError(
        `${spec.displayName} is waiting for approval but did not provide the request`,
        ErrorType.PROVIDER_ERROR,
      );
    }

    return { runId, output: snapshot.output ?? "", approval: snapshot.approval, ...activity };
  }

  if (snapshot.status === "completed") {
    return {
      runId,
      output: snapshot.output ?? "",
      ...(snapshot.usage ? { usage: snapshot.usage } : {}),
      ...(snapshot.session_id ? { sessionId: snapshot.session_id } : {}),
      ...(snapshot.runtime ? { runtime: snapshot.runtime } : {}),
      ...activity,
    };
  }

  if (snapshot.status === "interrupted") {
    throw new AssistantError(
      snapshot.error ??
        "The hosted agent restarted before this run finished. Session history is preserved; send another message to continue in the same conversation.",
      ErrorType.PROVIDER_ERROR,
    );
  }

  throw new AssistantError(
    snapshot.error ?? `${spec.displayName} ended the run as ${snapshot.status}`,
    ErrorType.PROVIDER_ERROR,
  );
}

export async function runHostedAgentTurn(params: {
  context: ServiceContext;
  client: AgentHostClient;
  spec: AgentHostSpec;
  userId: number;
  conversationId: string;
  input?: string;
  systemPrompt?: string;
  networkHosts?: string[];
  model?: string;
  modelOptions?: AgentHostRunRequest["modelOptions"];
  resume?: {
    runId: string;
    requestId?: string;
    choice: "once" | "deny";
  };
}): Promise<HostedAgentTurnResult> {
  const hostId = hostedAgentHostId(params.spec, params.userId);
  const input = params.resume ? "" : truncateAgentInput(params.input ?? "");
  const instructions = params.resume
    ? undefined
    : buildHostedAgentInstructions(params.systemPrompt);
  let runId: string;

  if (params.resume) {
    runId = params.resume.runId;
    await requireActiveExecutionRun(params.context);
  } else if (!input) {
    throw new AssistantError(
      `${params.spec.displayName} needs a message in a conversation`,
      ErrorType.PARAMS_ERROR,
    );
  }

  const mintToken = () =>
    createInternalServiceDelegationToken(params.context.env.JWT_SECRET ?? "", params.userId);

  let serviceToken = await mintToken();
  let lastProvisionAt = Date.now();

  const refreshProvision = async () => {
    serviceToken = await mintToken();
    lastProvisionAt = Date.now();
    await params.client.provision({
      hostId,
      serviceToken,
      ...(params.networkHosts && params.networkHosts.length > 0
        ? { networkHosts: params.networkHosts }
        : {}),
    });
  };

  await params.client.provision({
    hostId,
    serviceToken,
    ...(params.networkHosts && params.networkHosts.length > 0
      ? { networkHosts: params.networkHosts }
      : {}),
  });

  if (params.resume) {
    await params.client.answerApproval({
      hostId,
      runId,
      choice: params.resume.choice,
      ...(params.resume.requestId ? { requestId: params.resume.requestId } : {}),
    });
  } else {
    runId = await params.client.startRun({
      hostId,
      sessionId: hostedAgentSessionId(params.spec, params.conversationId),
      input,
      ...(instructions ? { instructions } : {}),
      ...(params.model ? { model: params.model } : {}),
      ...(params.modelOptions ? { modelOptions: params.modelOptions } : {}),
      idempotencyKey: generateId(),
    });
  }

  const stopAndCheckpoint = async () => {
    await params.client.stopRun({ hostId, runId }).catch(() => undefined);
    await params.client.checkpoint({ hostId }).catch(() => undefined);
  };

  const deadline = Date.now() + RUN_MAX_DURATION_MS;
  const progress = createAgentRunProgress();
  let lastSteerCheckAt = 0;

  const maybeSteer = async () => {
    if (Date.now() - lastSteerCheckAt < STEER_CHECK_INTERVAL_MS) {
      return;
    }

    lastSteerCheckAt = Date.now();
    await maybeSteerQueuedFollowUp({
      context: params.context,
      userId: params.userId,
      conversationId: params.conversationId,
      hostId,
      runId,
      client: params.client,
    }).catch(() => "none" as const);
  };

  const finishFromSnapshot = async (
    snapshot: AgentHostRunSnapshot,
  ): Promise<HostedAgentTurnResult> => {
    await replayPendingSteer({
      context: params.context,
      conversationId: params.conversationId,
      pendingSteer: snapshot.pending_steer,
    }).catch(() => undefined);

    return toTurnResult(params.spec, snapshot, runId, progress);
  };

  const pollForCompletion = async (): Promise<HostedAgentTurnResult> => {
    let pollDelay = RUN_POLL_INITIAL_MS;

    for (;;) {
      try {
        await requireActiveExecutionRun(params.context);
      } catch (error) {
        await stopAndCheckpoint();
        throw error;
      }

      if (Date.now() - lastProvisionAt >= SERVICE_TOKEN_REFRESH_MS) {
        await refreshProvision().catch(() => undefined);
      }

      await maybeSteer();

      const snapshot = await params.client.readRun({ hostId, runId });

      if (
        snapshot.status === "waiting_for_approval" ||
        isTerminalAgentHostRunStatus(snapshot.status)
      ) {
        return finishFromSnapshot(snapshot);
      }

      if (Date.now() >= deadline) {
        await stopAndCheckpoint();
        throw new AssistantError(
          `${params.spec.displayName} did not finish within ten minutes`,
          ErrorType.PROVIDER_ERROR,
          504,
        );
      }

      await abortableDelay(pollDelay);
      pollDelay = nextPollDelay(pollDelay);
    }
  };

  let eventsResponse: Response | null = null;

  try {
    eventsResponse = await params.client.openRunEvents({ hostId, runId });
  } catch {
    eventsResponse = null;
  }

  if (!eventsResponse) {
    return pollForCompletion();
  }

  try {
    const outcome = await followAgentRunEvents({
      response: eventsResponse,
      progress,
      checkIn: async () => {
        await requireActiveExecutionRun(params.context);
        await maybeSteer();
      },
      isExpired: () => Date.now() >= deadline,
      initialDelayMs: RUN_POLL_INITIAL_MS,
      maxDelayMs: RUN_POLL_MAX_MS,
    });

    if (outcome.kind === "expired") {
      await stopAndCheckpoint();
      throw new AssistantError(
        `${params.spec.displayName} did not finish within ten minutes`,
        ErrorType.PROVIDER_ERROR,
        504,
      );
    }

    if (outcome.kind === "stream-ended") {
      return pollForCompletion();
    }

    return finishFromSnapshot(await params.client.readRun({ hostId, runId }));
  } catch (error) {
    if (error instanceof AssistantError) {
      await stopAndCheckpoint();
      throw error;
    }

    return pollForCompletion();
  } finally {
    try {
      await eventsResponse.body?.cancel();
    } catch {
      // The event stream already ended or was consumed elsewhere.
    }
  }
}
