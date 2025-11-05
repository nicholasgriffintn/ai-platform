import { IEnv } from "../types";

export const SCHEDULES = {
	MEMORIES_SYNTHESIS: "0 2 * * *", // Daily at 2 AM
} as const;

export const ENABLED_SCHEDULES_FLAGS: Record<string, keyof IEnv> = {
	memory_synthesis: "MEMORY_SYNTHESIS_ENABLED",
};
