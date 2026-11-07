export const SCHEDULES = {
  MEMORIES_SYNTHESIS: "0 2 * * *", // Daily at 2 AM
  TRAINING_QUALITY_SCORING: "0 3 * * *", // Daily at 3 AM
  MODEL_GOVERNANCE: "0 3 * * *",
  MODEL_PLATFORM_RECONCILE: "*/15 * * * *",
  PROVIDER_QUOTA_SYNC: "*/15 * * * *",
  INFRA_RECONCILIATION: "0 4 * * *", // Daily at 4 AM
  D1_WRITE_BREAKER: "*/15 * * * *",
  SANDBOX_RUN_SWEEP: "*/15 * * * *",
  RECIPE_EXECUTION: "*/15 * * * *", // Poll recipe schedules every 15 minutes
  WORK_RHYTHM: "*/15 * * * *",
  WATCHING_INDEX: "0 3 * * *",
} as const;
