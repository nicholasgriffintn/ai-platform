import {
  threadCoordinatorStateSchema,
  threadInstructionSchema,
  type SubmitThreadInstruction,
  type ThreadCoordinatorState,
  type ThreadInstruction,
} from "@ngriffin_uk/polychat-schemas";

import type { IEnv } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/conversations/coordinator/client" });
const COORDINATOR_ORIGIN = "https://conversation-coordinator";

function getStub(env: IEnv | undefined, conversationId: string): DurableObjectStub | null {
  if (!env?.CONVERSATION_COORDINATOR) {
    return null;
  }

  const id = env.CONVERSATION_COORDINATOR.idFromName(conversationId);

  return env.CONVERSATION_COORDINATOR.get(id);
}

async function call<T>(
  env: IEnv | undefined,
  conversationId: string,
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  const stub = getStub(env, conversationId);

  if (!stub) {
    return null;
  }

  try {
    const response = await stub.fetch(`${COORDINATOR_ORIGIN}${path}`, init);

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    logger.error("Conversation coordinator call failed", { error, path, conversationId });

    return null;
  }
}

export async function enqueueThreadInstruction(params: {
  env: IEnv | undefined;
  conversationId: string;
  instruction: SubmitThreadInstruction;
}): Promise<ThreadInstruction | null> {
  const result = await call<{ instruction: unknown }>(
    params.env,
    params.conversationId,
    "/instructions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params.instruction),
    },
  );
  const parsed = threadInstructionSchema.safeParse(result?.instruction);

  return parsed.success ? parsed.data : null;
}

/**
 * Takes the next instruction the thread should run, marking the thread busy.
 * Returns null when another operation holds the thread or when the queue has
 * nothing that should run now.
 */
export async function claimThreadInstruction(params: {
  env: IEnv | undefined;
  conversationId: string;
}): Promise<ThreadInstruction | null> {
  const result = await call<{ instruction: unknown }>(params.env, params.conversationId, "/claim", {
    method: "POST",
  });
  const parsed = threadInstructionSchema.safeParse(result?.instruction);

  return parsed.success ? parsed.data : null;
}

/**
 * Takes the thread for a synchronous operation. Returns false when another
 * operation already holds it, so the caller can refuse rather than race.
 * When the coordinator binding is absent the thread is treated as free, so a
 * deployment without the Durable Object behaves exactly as it did before.
 */
export async function acquireThread(params: {
  env: IEnv | undefined;
  conversationId: string;
  kind: SubmitThreadInstruction["kind"];
}): Promise<{ acquired: boolean; currentOperation?: string | null }> {
  if (!params.env?.CONVERSATION_COORDINATOR) {
    return { acquired: true };
  }

  const result = await call<{ acquired?: boolean; currentOperation?: string | null }>(
    params.env,
    params.conversationId,
    "/acquire",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: params.kind }),
    },
  );

  if (!result) {
    return { acquired: true };
  }

  return { acquired: result.acquired === true, currentOperation: result.currentOperation };
}

export async function releaseThread(params: {
  env: IEnv | undefined;
  conversationId: string;
}): Promise<void> {
  await call(params.env, params.conversationId, "/release", { method: "POST" });
}

export async function getThreadCoordinatorState(params: {
  env: IEnv | undefined;
  conversationId: string;
}): Promise<ThreadCoordinatorState | null> {
  const result = await call<unknown>(params.env, params.conversationId, "/state");
  const parsed = threadCoordinatorStateSchema.safeParse(result);

  return parsed.success ? parsed.data : null;
}

export async function countQueuedInstructions(params: {
  env: IEnv | undefined;
  conversationId: string;
}): Promise<number> {
  const state = await getThreadCoordinatorState(params);

  return state?.queue.length ?? 0;
}
