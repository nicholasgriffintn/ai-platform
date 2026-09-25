export const SCHEDULES = {
  MEMORIES_SYNTHESIS: "0 2 * * *", // Daily at 2 AM
  TRAINING_QUALITY_SCORING: "0 3 * * *", // Daily at 3 AM
  MODEL_GOVERNANCE: "0 3 * * *",
  INFRA_RECONCILIATION: "0 4 * * *", // Daily at 4 AM
  RECIPE_EXECUTION: "*/15 * * * *", // Poll recipe schedules every 15 minutes
} as const;
