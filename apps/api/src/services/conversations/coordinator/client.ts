import { threadStatusSchema, type ThreadOperation } from "@ngriffin_uk/polychat-schemas";

import { getDurableObjectStub, postDurableObjectJson } from "~/lib/durable-objects/client";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
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
  kind: ThreadOperation;
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

export async function getActiveThreadOperation(params: {
  env: IEnv | undefined;
  conversationId: string;
}): Promise<ThreadOperation | null | undefined> {
  const outcome = await callCoordinator<unknown>(params.env, params.conversationId, "/status");

  if (outcome.status === "unavailable") {
    return undefined;
  }

  const parsed = outcome.status === "ok" ? threadStatusSchema.safeParse(outcome.data) : null;

  if (!parsed?.success) {
    throw new AssistantError(
      "Conversation status is temporarily unavailable",
      ErrorType.EXTERNAL_API_ERROR,
    );
  }

  return parsed.data.status === "running" ? parsed.data.currentOperation : null;
}

export function threadBusyError(currentOperation?: string | null): AssistantError {
  return new AssistantError(
    currentOperation
      ? `This conversation is already working on something (${currentOperation}). Try again once it finishes.`
      : "This conversation is already working on something. Try again once it finishes.",
    ErrorType.CONFLICT_ERROR,
  );
}

export interface ThreadLockRequest {
  env: IEnv | undefined;
  conversationId: string;
  kind: ThreadOperation;
}

export async function withThreadLock<T>(
  params: ThreadLockRequest,
  run: () => Promise<T>,
): Promise<T> {
  const lock = await acquireThread(params);

  if (!lock.acquired) {
    throw threadBusyError(lock.currentOperation);
  }

  try {
    return await run();
  } finally {
    await releaseThread({ env: params.env, conversationId: params.conversationId });
  }
}

export async function withThreadLockIfFree<T>(
  params: ThreadLockRequest,
  run: () => Promise<T>,
): Promise<T | null> {
  const lock = await acquireThread(params);

  if (!lock.acquired) {
    return null;
  }

  try {
    return await run();
  } finally {
    await releaseThread({ env: params.env, conversationId: params.conversationId });
  }
}
