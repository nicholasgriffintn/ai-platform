export interface RecoveryRequestContext {
  attempt: number;
  elapsedMs: number;
  finalAttempt: boolean;
  knownAssistantCount: number;
}

export function appendRecoveryTelemetry(
  params: URLSearchParams,
  recovery?: RecoveryRequestContext,
): void {
  if (!recovery) {
    return;
  }

  params.set("recovery_platform", "web");
  params.set("recovery_attempt", String(recovery.attempt));
  params.set("recovery_elapsed_ms", String(recovery.elapsedMs));
  params.set("recovery_known_assistant_count", String(recovery.knownAssistantCount));
  params.set("recovery_final_attempt", String(recovery.finalAttempt));
}
