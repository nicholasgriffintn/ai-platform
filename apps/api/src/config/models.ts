export const MODEL_READINESS_TTL_MS = 60_000;

export const MODEL_RUNTIME_READINESS_STATUSES = [
  "not_configured",
  "unreachable",
  "model_missing",
  "model_loading",
  "machine_offline",
  "desktop_required",
] as const;

export type ModelRuntimeReadinessStatus = (typeof MODEL_RUNTIME_READINESS_STATUSES)[number];
