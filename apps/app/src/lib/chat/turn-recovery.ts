import {
  isTerminalChatRunStatus,
  type ChatRun,
  type ChatRunCommandReceipt,
} from "@ngriffin_uk/polychat-schemas";

import type { Message } from "~/types";

const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 180_000;

export interface ChatRunSnapshot {
  run: ChatRun;
  messages: Message[];
}

export interface RecoverDetachedTurnParams {
  runId?: string;
  resolveCommand?: () => Promise<string | null>;
  fetchRun: (runId: string) => Promise<ChatRunSnapshot>;
  signal?: AbortSignal;
  onSnapshot?: (snapshot: ChatRunSnapshot) => void | Promise<void>;
  onAttempt?: (attempt: number) => void;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  wait?: (ms: number) => Promise<void>;
  now?: () => number;
}

function defaultWait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resolveAcceptedRunCommand(params: {
  fetchCommand: () => Promise<ChatRunCommandReceipt>;
  attempts?: number;
  intervalMs?: number;
  wait?: (ms: number) => Promise<void>;
}): Promise<ChatRun | null> {
  const attempts = params.attempts ?? 10;
  const intervalMs = params.intervalMs ?? 250;
  const wait = params.wait ?? defaultWait;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return (await params.fetchCommand()).run;
    } catch {
      if (attempt + 1 < attempts) {
        await wait(intervalMs);
      }
    }
  }

  return null;
}

function isRecoveryCheckpoint(run: ChatRun): boolean {
  return (
    run.status === "awaiting_input" ||
    run.status === "awaiting_approval" ||
    isTerminalChatRunStatus(run.status)
  );
}

export async function recoverDetachedTurn({
  runId: initialRunId,
  resolveCommand,
  fetchRun,
  signal,
  onSnapshot,
  onAttempt,
  pollIntervalMs = POLL_INTERVAL_MS,
  maxWaitMs = MAX_WAIT_MS,
  wait = defaultWait,
  now = Date.now,
}: RecoverDetachedTurnParams): Promise<ChatRunSnapshot | null> {
  const deadline = now() + maxWaitMs;
  let attempt = 0;
  let runId = initialRunId;

  while (!signal?.aborted && now() < deadline) {
    attempt += 1;
    onAttempt?.(attempt);

    await wait(pollIntervalMs);

    if (signal?.aborted) {
      break;
    }

    try {
      runId ??= (await resolveCommand?.()) ?? undefined;

      if (!runId) {
        continue;
      }

      const snapshot = await fetchRun(runId);

      await onSnapshot?.(snapshot);

      if (isRecoveryCheckpoint(snapshot.run)) {
        return snapshot;
      }
    } catch {
      continue;
    }
  }

  return null;
}
