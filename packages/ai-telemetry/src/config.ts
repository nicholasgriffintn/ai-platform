import { readBooleanEnv } from "@ngriffin_uk/polychat-utility-server/env";

import type { TelemetryEnv } from "./types.js";

export function shouldCaptureAiObservability(
  env: TelemetryEnv,
  { sentry = false }: { sentry?: boolean } = {},
): boolean {
  if (!readBooleanEnv(env.AI_OBSERVABILITY_ENABLED, true)) {
    return false;
  }

  return sentry || Boolean(env.TELEMETRY_STREAM);
}
