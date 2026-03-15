import {
	SANDBOX_RUN_DISPATCH_TASK_TYPE,
	type TaskType,
} from "@assistant/schemas";
import { IEnv } from "../types";

export const SCHEDULES = {
	MEMORIES_SYNTHESIS: "0 2 * * *", // Daily at 2 AM
	TRAINING_QUALITY_SCORING: "0 3 * * *", // Daily at 3 AM
} as const;

type FeatureFlaggedTaskType = "memory_synthesis" | "training_quality_scoring";

export const ENABLED_SCHEDULES_FLAGS: Record<
	FeatureFlaggedTaskType,
	keyof IEnv
> = {
	memory_synthesis: "MEMORY_SYNTHESIS_ENABLED",
	training_quality_scoring: "TRAINING_QUALITY_SCORING_ENABLED",
};

export const ALWAYS_ENABLED_SCHEDULES = [
	"research_polling",
	"replicate_polling",
	"async_message_polling",
	"usage_update",
	SANDBOX_RUN_DISPATCH_TASK_TYPE,
] as const satisfies readonly TaskType[];
