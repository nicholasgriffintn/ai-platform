import type { ThreadInstructionKind } from "@ngriffin_uk/polychat-schemas";

import { getDurableObjectStub, postDurableObjectJson } from "~/lib/durable-objects/client";
import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/conversations/coordinator/client" });
const COORDINATOR_ORIGIN = "https://conversation-coordinator";

type CoordinatorOutcome<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable" }
  | { status: "failed" };

async function callCoordinator<T>(
  env: IEnv | undefined,
  conversationId: string,
  path: string,
  body?: unknown,
): Promise<CoordinatorOutcome<T>> {
  const stub = getDurableObjectStub(env?.CONVERSATION_COORDINATOR, conversationId);

  if (!stub) {
    return { status: "unavailable" };
  }

  try {
    const response = await postDurableObjectJson(stub, `${COORDINATOR_ORIGIN}${path}`, body);

    if (!response.ok) {
      logger.error("Conversation coordinator refused a call", {
        conversationId,
        path,
        status: response.status,
      });

      return { status: "failed" };
    }

    return { status: "ok", data: (await response.json()) as T };
  } catch (error) {
    logger.error("Conversation coordinator call failed", { error, path, conversationId });

    return { status: "failed" };
  }
}

/**
 * Takes the thread for a synchronous operation. Returns false when another
 * operation already holds it, so the caller can refuse rather than race.
 * A deployment without the Durable Object treats the thread as free, exactly
 * as it did before the coordinator existed. A coordinator that is configured
 * but unreachable refuses instead: granting a lock we could not take would
 * let two turns interleave writes to the same conversation, and the caller
 * can retry a refusal.
 */
export async function acquireThread(params: {
  env: IEnv | undefined;
  conversationId: string;
  kind: ThreadInstructionKind;
}): Promise<{ acquired: boolean; currentOperation?: string | null }> {
  const outcome = await callCoordinator<{
    acquired?: boolean;
    currentOperation?: string | null;
  }>(params.env, params.conversationId, "/acquire", { kind: params.kind });

  if (outcome.status === "unavailable") {
    return { acquired: true };
  }

  if (outcome.status === "failed") {
    return { acquired: false, currentOperation: null };
  }

  return {
    acquired: outcome.data.acquired === true,
    currentOperation: outcome.data.currentOperation,
  };
}

export async function releaseThread(params: {
  env: IEnv | undefined;
  conversationId: string;
}): Promise<void> {
  await callCoordinator(params.env, params.conversationId, "/release");
}
