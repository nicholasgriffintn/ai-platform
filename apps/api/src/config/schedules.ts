export const SCHEDULES = {
  MEMORIES_SYNTHESIS: "0 2 * * *", // Daily at 2 AM
  TRAINING_QUALITY_SCORING: "0 3 * * *", // Daily at 3 AM
  MODEL_GOVERNANCE: "0 3 * * *",
  BENCHMARK_QUEUE: "0 3 * * *",
  MODEL_PLATFORM_RECONCILE: "*/15 * * * *",
  INFRA_RECONCILIATION: "0 4 * * *", // Daily at 4 AM
  RECIPE_EXECUTION: "*/15 * * * *", // Poll recipe schedules every 15 minutes
  SKILL_OUTCOME_REVIEW: "0 5 * * 1", // Weekly on Monday at 5 AM
} as const;
