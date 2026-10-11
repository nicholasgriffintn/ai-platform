import {
  isTerminalAgentHostRunStatus,
  type AgentHostRunSnapshot,
} from "@ngriffin_uk/polychat-schemas";
import { abortableDelay } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { createInternalServiceDelegationToken } from "@ngriffin_uk/polychat-utility-server/internal-service-auth";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireActiveExecutionRun } from "~/modules/chat-runs/application/execution-authority";

import type { AgentHostClient } from "./AgentHostClient";

const RUN_POLL_INTERVAL_MS = 1000;
const RUN_MAX_DURATION_MS = 10 * 60 * 1000;

export interface HostedHermesTurnResult {
  runId: string;
  output: string;
  approval?: NonNullable<AgentHostRunSnapshot["approval"]>;
}

export function hostedHermesHostId(userId: number): string {
  return `hermes-${userId}`;
}

export function hostedHermesSessionId(conversationId: string): string {
  return `polychat-${conversationId.replace(/[^A-Za-z0-9_-]/gu, "-")}`.slice(0, 160);
}

export async function runHostedHermesTurn(params: {
  context: ServiceContext;
  client: AgentHostClient;
  userId: number;
  conversationId: string;
  input?: string;
  resume?: {
    runId: string;
    requestId?: string;
    choice: "once" | "deny";
  };
}): Promise<HostedHermesTurnResult> {
  const hostId = hostedHermesHostId(params.userId);
  const input = params.input ?? "";
  let runId: string;

  if (params.resume) {
    runId = params.resume.runId;
    await requireActiveExecutionRun(params.context);
  } else if (!input) {
    throw new AssistantError("Hermes needs a message in a conversation", ErrorType.PARAMS_ERROR);
  }

  const serviceToken = await createInternalServiceDelegationToken(
    params.context.env.JWT_SECRET ?? "",
    params.userId,
  );

  await params.client.provision({ hostId, serviceToken });

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
      sessionId: hostedHermesSessionId(params.conversationId),
      input,
    });
  }

  const deadline = Date.now() + RUN_MAX_DURATION_MS;

  while (true) {
    try {
      await requireActiveExecutionRun(params.context);
    } catch (error) {
      await params.client.stopRun({ hostId, runId }).catch(() => undefined);
      throw error;
    }

    const snapshot = await params.client.readRun({ hostId, runId });

    if (snapshot.status === "waiting_for_approval") {
      if (!snapshot.approval) {
        throw new AssistantError(
          "Hermes is waiting for approval but did not provide the request",
          ErrorType.PROVIDER_ERROR,
        );
      }

      return { runId, output: snapshot.output ?? "", approval: snapshot.approval };
    }

    if (isTerminalAgentHostRunStatus(snapshot.status)) {
      if (snapshot.status === "completed") {
        return { runId, output: snapshot.output ?? "" };
      }

      throw new AssistantError(
        snapshot.error ?? `Hermes ended the run as ${snapshot.status}`,
        ErrorType.PROVIDER_ERROR,
      );
    }

    if (Date.now() >= deadline) {
      await params.client.stopRun({ hostId, runId }).catch(() => undefined);
      throw new AssistantError(
        "Hermes did not finish within ten minutes",
        ErrorType.PROVIDER_ERROR,
        504,
      );
    }

    await abortableDelay(RUN_POLL_INTERVAL_MS);
  }
}
