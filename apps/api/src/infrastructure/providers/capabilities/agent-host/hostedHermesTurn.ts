import {
  isTerminalAgentHostRunStatus,
  type AgentHostRunRequest,
  type AgentHostRunSnapshot,
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
  approval?: NonNullable<AgentHostRunSnapshot["approval"]>;
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
  userId: number,
): Promise<void> {
  const hostId = hostedHermesHostId(userId);
  const existingKeys = await getUserApiKeys(context, userId, HOSTED_HERMES_KEY_NAME);

  for (const key of existingKeys) {
    await deleteUserApiKey(context, key.id, userId);
  }

  const { plaintextKey } = await createUserApiKey(context, HOSTED_HERMES_KEY_NAME, userId);

  await client.provision({ hostId, apiKey: plaintextKey });
}

async function startHostedRun(
  context: ServiceContext,
  client: AgentHostClient,
  userId: number,
  request: AgentHostRunRequest,
): Promise<string> {
  try {
    return await client.startRun(request);
  } catch (error) {
    if (!(error instanceof AgentHostUnprovisionedError)) {
      throw error;
    }

    await provisionHostedHermes(context, client, userId);

    return client.startRun(request);
  }
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
  let runId: string;

  if (params.resume) {
    runId = params.resume.runId;
    await requireActiveExecutionRun(params.context);
    await params.client.answerApproval({
      hostId,
      runId,
      choice: params.resume.choice,
      ...(params.resume.requestId ? { requestId: params.resume.requestId } : {}),
    });
  } else {
    if (!params.input) {
      throw new AssistantError("Hermes needs a message in a conversation", ErrorType.PARAMS_ERROR);
    }

    runId = await startHostedRun(params.context, params.client, params.userId, {
      hostId,
      sessionId: hostedHermesSessionId(params.conversationId),
      input: params.input,
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
