import {
  REALTIME_MAX_SESSION_SECONDS_DEFAULT,
  REALTIME_MAX_SESSION_SECONDS_MAX,
  REALTIME_MAX_SESSION_SECONDS_MIN,
} from "~/config/realtime";
import type { IEnv } from "~/types";

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
