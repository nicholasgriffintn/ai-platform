import { SANDBOX_RUN_DISPATCH_TASK_TYPE, type TaskType } from "@assistant/schemas";
import { IEnv } from "../types";

export const SCHEDULES = {
	MEMORIES_SYNTHESIS: "0 2 * * *", // Daily at 2 AM
	TRAINING_QUALITY_SCORING: "0 3 * * *", // Daily at 3 AM
	RECIPE_EXECUTION: "*/15 * * * *", // Poll recipe schedules every 15 minutes
} as const;

type FeatureFlaggedTaskType = "memory_synthesis" | "training_quality_scoring";

export const ENABLED_SCHEDULES_FLAGS: Record<FeatureFlaggedTaskType, keyof IEnv> = {
	memory_synthesis: "MEMORY_SYNTHESIS_ENABLED",
	training_quality_scoring: "TRAINING_QUALITY_SCORING_ENABLED",
};

export const ALWAYS_ENABLED_SCHEDULES = [
	"research_polling",
	"replicate_polling",
	"async_message_polling",
	"podcast_transcription_polling",
	"usage_update",
	"recipe_execution",
	"artificial_analysis_ingest",
	"artificial_analysis_scoring",
	SANDBOX_RUN_DISPATCH_TASK_TYPE,
] as const satisfies readonly TaskType[];
