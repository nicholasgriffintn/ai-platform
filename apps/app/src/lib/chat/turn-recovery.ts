import type { Message } from "~/types";

const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 180_000;

export interface RecoverDetachedTurnParams {
  completionId: string;
  knownMessageIds: Set<string>;
  fetchMessages: (completionId: string, attempt: RecoveryAttemptContext) => Promise<Message[]>;
  signal?: AbortSignal;
  onAttempt?: (attempt: number) => void;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  wait?: (ms: number) => Promise<void>;
  now?: () => number;
}

export interface RecoveryAttemptContext {
  attempt: number;
  elapsedMs: number;
  finalAttempt: boolean;
}

function defaultWait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function selectRecoveredMessages(
  messages: Message[],
  knownMessageIds: Set<string>,
): Message[] {
  const recovered = messages.filter(
    (message) => message.role !== "user" && message.id && !knownMessageIds.has(message.id),
  );

  return recovered.some((message) => message.role === "assistant") ? recovered : [];
}

export async function recoverDetachedTurn({
  completionId,
  knownMessageIds,
  fetchMessages,
  signal,
  onAttempt,
  pollIntervalMs = POLL_INTERVAL_MS,
  maxWaitMs = MAX_WAIT_MS,
  wait = defaultWait,
  now = Date.now,
}: RecoverDetachedTurnParams): Promise<Message[]> {
  const startedAt = now();
  const deadline = startedAt + maxWaitMs;
  let attempt = 0;

  while (!signal?.aborted && now() < deadline) {
    attempt += 1;
    onAttempt?.(attempt);

    await wait(pollIntervalMs);

    if (signal?.aborted) {
      break;
    }

    try {
      const elapsedMs = Math.max(0, now() - startedAt);
      const finalAttempt = elapsedMs + pollIntervalMs >= maxWaitMs;
      const recovered = selectRecoveredMessages(
        await fetchMessages(completionId, { attempt, elapsedMs, finalAttempt }),
        knownMessageIds,
      );

      if (recovered.length) {
        return recovered;
      }

      if (finalAttempt) {
        break;
      }
    } catch {
      continue;
    }
  }

  return [];
}
