import type { IEnv } from "~/types";

export const REALTIME_MAX_SESSION_SECONDS_DEFAULT = 1800;
export const REALTIME_MAX_SESSION_SECONDS_MIN = 60;
export const REALTIME_MAX_SESSION_SECONDS_MAX = 3600;
export const REALTIME_RESERVATION_SECONDS = 300;
export const REALTIME_RECONCILIATION_BUFFER_SECONDS = 120;

export function resolveRealtimeMaxSessionSeconds(
  env: Pick<IEnv, "REALTIME_MAX_SESSION_SECONDS">,
): number {
  const parsed = Number.parseInt(env.REALTIME_MAX_SESSION_SECONDS ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return REALTIME_MAX_SESSION_SECONDS_DEFAULT;
  }

  return Math.min(
    REALTIME_MAX_SESSION_SECONDS_MAX,
    Math.max(REALTIME_MAX_SESSION_SECONDS_MIN, parsed),
  );
}
