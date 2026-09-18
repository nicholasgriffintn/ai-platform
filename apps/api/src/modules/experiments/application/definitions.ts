import { createDefinitionRegistry, defineFlag } from "@ngriffin_uk/polychat-ai-experiments";
import type { TaskType } from "@ngriffin_uk/polychat-schemas";

import { TASK_FLAGS } from "~/config/experiments";
import type { IEnv } from "~/types";

function envToggle(env: IEnv, key: keyof IEnv): boolean {
  return env[key] === "true";
}

export function taskFlags(env: IEnv) {
  return {
    memory_synthesis: defineFlag({
      key: "memory_synthesis",
      description: TASK_FLAGS.memory_synthesis.description,
      defaultValue: envToggle(env, TASK_FLAGS.memory_synthesis.envKey),
      variants: { ...TASK_FLAGS.memory_synthesis.variants },
    }),
    training_quality_scoring: defineFlag({
      key: "training_quality_scoring",
      description: TASK_FLAGS.training_quality_scoring.description,
      defaultValue: envToggle(env, TASK_FLAGS.training_quality_scoring.envKey),
      variants: { ...TASK_FLAGS.training_quality_scoring.variants },
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
