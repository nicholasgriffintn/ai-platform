import { IEnv } from "../types";

export const SCHEDULES = {
	MEMORIES_SYNTHESIS: "0 2 * * *", // Daily at 2 AM
	TRAINING_QUALITY_SCORING: "0 3 * * *", // Daily at 3 AM
} as const;

export const ENABLED_SCHEDULES_FLAGS: Record<string, keyof IEnv> = {
	memory_synthesis: "MEMORY_SYNTHESIS_ENABLED",
	training_quality_scoring: "TRAINING_QUALITY_SCORING_ENABLED",
};

export const ALWAYS_ENABLED_SCHEDULES: string[] = [
	"research_polling",
	"replicate_polling",
	"async_message_polling",
	"usage_update",
];
