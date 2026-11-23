import type { ConversationRunEffectRow } from "~/infrastructure/database/schema";

export type RunEffectKind = ConversationRunEffectRow["kind"];
export type RunEffectStatus = ConversationRunEffectRow["status"];
export type RunEffectReplay = "replay_safe" | "process_bound";

export const RUN_EFFECT_REPLAY = {
  cancel_cleanup: "replay_safe",
  release_follow_up: "replay_safe",
  approval_respond: "process_bound",
} as const satisfies Record<RunEffectKind, RunEffectReplay>;

type KindsWithReplay<Replay extends RunEffectReplay> = {
  [Kind in RunEffectKind]: (typeof RUN_EFFECT_REPLAY)[Kind] extends Replay ? Kind : never;
}[RunEffectKind];

export type ReplaySafeRunEffectKind = KindsWithReplay<"replay_safe">;
export type ProcessBoundRunEffectKind = KindsWithReplay<"process_bound">;

function kindsWithReplay<Replay extends RunEffectReplay>(
  replay: Replay,
): KindsWithReplay<Replay>[] {
  return (Object.keys(RUN_EFFECT_REPLAY) as RunEffectKind[]).filter(
    (kind): kind is KindsWithReplay<Replay> => RUN_EFFECT_REPLAY[kind] === replay,
  );
}

export const REPLAY_SAFE_RUN_EFFECT_KINDS = kindsWithReplay("replay_safe");
export const PROCESS_BOUND_RUN_EFFECT_KINDS = kindsWithReplay("process_bound");

export const RUN_EFFECT_MAX_ATTEMPTS = 8;
export const RUN_EFFECT_LEASE_MS = 60_000;
const RUN_EFFECT_BASE_BACKOFF_MS = 5_000;
const RUN_EFFECT_MAX_BACKOFF_MS = 5 * 60_000;

export function runEffectRetryDelayMs(attemptCount: number): number {
  return Math.min(
    RUN_EFFECT_MAX_BACKOFF_MS,
    RUN_EFFECT_BASE_BACKOFF_MS * 2 ** Math.max(0, attemptCount - 1),
  );
}

export const PROCESS_BOUND_ABANDONED_REASON = {
  pending:
    "The session that accepted this response ended before acting on it, so the action was not run.",
  running:
    "The session ended while acting on this response. It was not retried because it may already have taken effect.",
} as const;

export const PROCESS_BOUND_REFUSED_REASON =
  "This response belongs to a session that is no longer live, so the action was not run.";
