import {
  createExecutionControl as createSandboxExecutionControl,
  type ExecutionControl,
  type RunControlSource,
} from "@ngriffin_uk/polychat-library-sandbox";

import type { TaskEventEmitter } from "../types";
import { RunControlClient } from "./run-control-client";

interface CreateExecutionControlOptions {
  runId?: string;
  timeoutSeconds?: number;
  userToken: string;
  apiService: Pick<Fetcher, "fetch">;
  abortSignal?: AbortSignal;
  emitEvent?: TaskEventEmitter;
}

export type { ExecutionControl };

export function createExecutionControl(options: CreateExecutionControlOptions): ExecutionControl {
  const { runId, timeoutSeconds, userToken, apiService, abortSignal, emitEvent } = options;
  const control: RunControlSource | null = runId
    ? {
        fetchState: (signal) =>
          new RunControlClient({ userToken, runId, apiService }).fetchControlState(signal),
      }
    : null;

  return createSandboxExecutionControl({
    timeoutMs:
      typeof timeoutSeconds === "number" && Number.isFinite(timeoutSeconds)
        ? timeoutSeconds * 1000
        : undefined,
    abortSignal,
    control,
    onPaused: (message) => emitEvent?.({ type: "run_paused", runId, message }),
    onStillPaused: (message) => emitEvent?.({ type: "run_paused", runId, message }),
    onResumed: () => emitEvent?.({ type: "run_resumed", runId, message: "Run resumed" }),
  });
}
