import type { RealtimeTranscriptionDelay } from "@ngriffin_uk/polychat-ai-providers";

export const REALTIME_TURN_END_TIMEOUT_MS_BY_DELAY: Record<RealtimeTranscriptionDelay, number> = {
  minimal: 640,
  low: 1600,
  medium: 3200,
  high: 5600,
  xhigh: 8000,
};

export type RealtimeTurnEvent = "start" | "update" | "eager_end" | "resume" | "end";

export function buildRealtimeTurnMessage(event: RealtimeTurnEvent, transcript?: string): string {
  return JSON.stringify({ type: `turn.${event}`, ...(transcript ? { transcript } : {}) });
}

export function buildRealtimeErrorMessage(message?: string, code?: unknown): string {
  return JSON.stringify({
    type: "error",
    error: { message, ...(code === undefined ? {} : { code }) },
  });
}
