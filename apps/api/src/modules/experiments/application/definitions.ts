import { createDefinitionRegistry, defineFlag } from "@ngriffin_uk/polychat-ai-experiments";
import type { TaskType } from "@ngriffin_uk/polychat-schemas";

import type { IEnv } from "~/types";

function envToggle(env: IEnv, key: keyof IEnv): boolean {
  return env[key] === "true";
}

export function taskFlags(env: IEnv) {
  return {
    memory_synthesis: defineFlag({
      key: "memory_synthesis",
      description: "Run the nightly memory synthesis task",
      defaultValue: envToggle(env, "MEMORY_SYNTHESIS_ENABLED"),
      variants: { on: true, off: false },
    }),
    training_quality_scoring: defineFlag({
      key: "training_quality_scoring",
      description: "Run the nightly training quality scoring task",
      defaultValue: envToggle(env, "TRAINING_QUALITY_SCORING_ENABLED"),
      variants: { on: true, off: false },
    }),
  } satisfies Partial<Record<TaskType, unknown>>;
}

export type TaskFlagType = keyof ReturnType<typeof taskFlags>;

export function isTaskFlagType(taskType: TaskType): taskType is TaskFlagType {
  return taskType === "memory_synthesis" || taskType === "training_quality_scoring";
}

export function experimentDefinitions(env: IEnv) {
  return createDefinitionRegistry(Object.values(taskFlags(env)));
}
