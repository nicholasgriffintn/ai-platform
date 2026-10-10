import {
  isTerminalAgentHostRunStatus,
  type AgentHostRunRequest,
  type ModelTier,
} from "@ngriffin_uk/polychat-schemas";
import { abortableDelay } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireActiveExecutionRun } from "~/modules/chat-runs/application/execution-authority";
import {
  createUserApiKey,
  deleteUserApiKey,
  getUserApiKeys,
} from "~/modules/user/application/apiKeys";

import type { AgentHostClient } from "./AgentHostClient";
import { AgentHostUnprovisionedError } from "./AgentHostUnprovisionedError";

export const HOSTED_HERMES_KEY_NAME = "Hosted Hermes";

const RUN_POLL_INTERVAL_MS = 1000;
const RUN_MAX_DURATION_MS = 10 * 60 * 1000;

export interface HostedHermesTurnResult {
  runId: string;
  output: string;
  deniedActions: string[];
}

export function hostedHermesHostId(userId: number): string {
  return `hermes-${userId}`;
}

export function hostedHermesSessionId(conversationId: string): string {
  return `polychat-${conversationId.replace(/[^A-Za-z0-9_-]/gu, "-")}`.slice(0, 160);
}

async function provisionHostedHermes(
  context: ServiceContext,
  client: AgentHostClient,
  hostId: string,
): Promise<void> {
  const existingKeys = await getUserApiKeys(context);

  for (const key of existingKeys.filter((candidate) => candidate.name === HOSTED_HERMES_KEY_NAME)) {
    await deleteUserApiKey(context, key.id);
  }

  const { plaintextKey } = await createUserApiKey(context, HOSTED_HERMES_KEY_NAME);

  await client.provision({ hostId, apiKey: plaintextKey });
}

async function startHostedRun(
  context: ServiceContext,
  client: AgentHostClient,
  request: AgentHostRunRequest,
): Promise<string> {
  try {
    return await client.startRun(request);
  } catch (error) {
    if (!(error instanceof AgentHostUnprovisionedError)) {
      throw error;
    }

    await provisionHostedHermes(context, client, request.hostId);

    return client.startRun(request);
  }
}

export async function prepareHostedHermes(
  context: ServiceContext,
  client: AgentHostClient,
  userId: number,
): Promise<void> {
  const hostId = hostedHermesHostId(userId);

  try {
    await client.wake(hostId);
  } catch (error) {
    if (!(error instanceof AgentHostUnprovisionedError)) {
      throw error;
    }

    await provisionHostedHermes(context, client, hostId);
    await client.wake(hostId);
  }
}

function describeDeniedAction(approval: { command?: string; description?: string }): string {
  return approval.description || approval.command || "an action Hermes flagged for approval";
}

export async function runHostedHermesTurn(params: {
  context: ServiceContext;
  client: AgentHostClient;
  userId: number;
  conversationId: string;
  input: string;
  modelTier: ModelTier;
}): Promise<HostedHermesTurnResult> {
  const hostId = hostedHermesHostId(params.userId);
  const runId = await startHostedRun(params.context, params.client, {
    hostId,
    sessionId: hostedHermesSessionId(params.conversationId),
    input: params.input,
    modelTier: params.modelTier,
  });
  const deadline = Date.now() + RUN_MAX_DURATION_MS;
  const deniedActions: string[] = [];
  const deniedApprovalKeys = new Set<string>();

  while (true) {
    try {
      await requireActiveExecutionRun(params.context);
    } catch (error) {
      await params.client.stopRun({ hostId, runId }).catch(() => undefined);
      throw error;
    }

    const snapshot = await params.client.readRun({ hostId, runId });

    const approvalKey = snapshot.approval
      ? (snapshot.approval.request_id ?? describeDeniedAction(snapshot.approval))
      : undefined;

    if (
      snapshot.status === "waiting_for_approval" &&
      snapshot.approval &&
      approvalKey &&
      !deniedApprovalKeys.has(approvalKey)
    ) {
      deniedApprovalKeys.add(approvalKey);
      deniedActions.push(describeDeniedAction(snapshot.approval));
      await params.client.answerApproval({
        hostId,
        runId,
        choice: "deny",
        ...(snapshot.approval.request_id ? { requestId: snapshot.approval.request_id } : {}),
      });
    } else if (isTerminalAgentHostRunStatus(snapshot.status)) {
      if (snapshot.status === "completed") {
        return { runId, output: snapshot.output ?? "", deniedActions };
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
