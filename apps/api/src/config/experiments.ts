import type { IEnv } from "~/types";

export interface TaskFlagConfig {
  description: string;
  envKey: keyof IEnv;
  variants: Record<string, boolean>;
}

export const TASK_FLAGS = {
  memory_synthesis: {
    description: "Run the nightly memory synthesis task",
    envKey: "MEMORY_SYNTHESIS_ENABLED",
    variants: { on: true, off: false },
  },
  training_quality_scoring: {
    description: "Run the nightly training quality scoring task",
    envKey: "TRAINING_QUALITY_SCORING_ENABLED",
    variants: { on: true, off: false },
  },
} as const satisfies Record<string, TaskFlagConfig>;
