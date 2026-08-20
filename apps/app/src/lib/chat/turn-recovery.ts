import type { Message } from "~/types";

const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 180_000;

export interface RecoverDetachedTurnParams {
  completionId: string;
  knownMessageIds: Set<string>;
  fetchMessages: (completionId: string) => Promise<Message[]>;
  signal?: AbortSignal;
  onAttempt?: (attempt: number) => void;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  wait?: (ms: number) => Promise<void>;
  now?: () => number;
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
  const deadline = now() + maxWaitMs;
  let attempt = 0;

  while (!signal?.aborted && now() < deadline) {
    attempt += 1;
    onAttempt?.(attempt);

    await wait(pollIntervalMs);

    if (signal?.aborted) {
      break;
    }

    try {
      const recovered = selectRecoveredMessages(await fetchMessages(completionId), knownMessageIds);

      if (recovered.length) {
        return recovered;
      }
    } catch {
      continue;
    }
  }

  return [];
}
