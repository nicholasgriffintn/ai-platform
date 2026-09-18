import { SandboxCancellationError, SandboxTimeoutError, throwIfAborted } from "./errors.js";

export type RunControlState = "queued" | "running" | "paused" | "cancelled" | "inspection";

export interface RunControlSnapshot {
  state: RunControlState;
  cancellationReason?: string;
  pauseReason?: string;
}

export interface RunControlSource {
  fetchState(signal?: AbortSignal): Promise<RunControlSnapshot | null>;
}

export interface ExecutionControlEvents {
  onPaused?(reason: string): Promise<void> | void;
  onStillPaused?(reason: string): Promise<void> | void;
  onResumed?(): Promise<void> | void;
}

export interface CreateExecutionControlOptions extends ExecutionControlEvents {
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  control?: RunControlSource | null;
  pausePollIntervalMs?: number;
  pauseHeartbeatIntervalMs?: number;
  controlStateMinRefreshMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface ExecutionControl {
  checkpoint(abortMessage: string): Promise<void>;
  deadlineAt: number | undefined;
}

const DEFAULT_PAUSE_POLL_INTERVAL_MS = 2000;
const DEFAULT_PAUSE_HEARTBEAT_INTERVAL_MS = 30000;
const DEFAULT_CONTROL_STATE_MIN_REFRESH_MS = 1000;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createExecutionControl(options: CreateExecutionControlOptions): ExecutionControl {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const pausePollIntervalMs = options.pausePollIntervalMs ?? DEFAULT_PAUSE_POLL_INTERVAL_MS;
  const pauseHeartbeatIntervalMs =
    options.pauseHeartbeatIntervalMs ?? DEFAULT_PAUSE_HEARTBEAT_INTERVAL_MS;
  const controlStateMinRefreshMs =
    options.controlStateMinRefreshMs ?? DEFAULT_CONTROL_STATE_MIN_REFRESH_MS;
  const timeoutMs =
    typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs)
      ? options.timeoutMs
      : undefined;
  const deadlineAt = timeoutMs === undefined ? undefined : now() + timeoutMs;
  const control = options.control ?? null;
  let lastFetchedAt = 0;
  let lastSnapshot: RunControlSnapshot | null = null;

  const throwIfTimedOut = () => {
    if (deadlineAt === undefined || now() <= deadlineAt) {
      return;
    }

    const seconds = Math.max(1, Math.floor((timeoutMs ?? 1000) / 1000));

    throw new SandboxTimeoutError(`Sandbox run timed out after ${seconds} seconds`);
  };

  const fetchState = async (minRefreshMs: number): Promise<RunControlSnapshot | null> => {
    if (!control) {
      return null;
    }

    if (lastFetchedAt > 0 && now() - lastFetchedAt < minRefreshMs) {
      return lastSnapshot;
    }

    lastSnapshot = await control.fetchState(options.abortSignal);
    lastFetchedAt = now();

    return lastSnapshot;
  };

  const waitWhilePaused = async (pauseReason?: string) => {
    await options.onPaused?.(pauseReason || "Run paused by user request");
    let lastHeartbeatAt = now();

    while (true) {
      throwIfAborted(options.abortSignal, "Sandbox run cancelled while paused");
      throwIfTimedOut();

      await sleep(pausePollIntervalMs);
      const next = await fetchState(pausePollIntervalMs);

      if (!next) {
        continue;
      }

      if (next.state === "cancelled") {
        throw new SandboxCancellationError(
          next.cancellationReason || "Sandbox run cancelled while paused",
        );
      }

      if (next.state === "paused") {
        if (now() - lastHeartbeatAt >= pauseHeartbeatIntervalMs) {
          lastHeartbeatAt = now();
          await options.onStillPaused?.(next.pauseReason || "Run is still paused");
        }

        continue;
      }

      await options.onResumed?.();

      return;
    }
  };

  return {
    deadlineAt,
    checkpoint: async (abortMessage) => {
      throwIfAborted(options.abortSignal, abortMessage);
      throwIfTimedOut();

      const snapshot = await fetchState(controlStateMinRefreshMs);

      if (!snapshot) {
        return;
      }

      if (snapshot.state === "cancelled") {
        throw new SandboxCancellationError(snapshot.cancellationReason || "Sandbox run cancelled");
      }

      if (snapshot.state === "paused") {
        await waitWhilePaused(snapshot.pauseReason);
      }
    },
  };
}
