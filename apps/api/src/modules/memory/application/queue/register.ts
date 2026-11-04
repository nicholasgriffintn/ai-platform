import {
  MEMORY_CONSOLIDATION_TASK_TYPE,
  MEMORY_IMPORT_TASK_TYPE,
  MEMORY_REFLECTION_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import { SCHEDULES } from "~/config/schedules";
import { evaluateServerFlag, taskFlags } from "~/modules/experiments/application";
import { d1WritesAllowed } from "~/modules/infra/application/write-breaker";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";

import { memoryConsolidation } from "./memory-consolidation";
import { memoryImport } from "./memory-import";
import { memoryReflection, memorySynthesis } from "./memory-synthesis";
import { scheduleDailySynthesis } from "./schedule";

export function registerMemoryQueue(workflows: AppWorkflows): void {
  workflows.on("memory_synthesis", memorySynthesis);
  workflows.on(MEMORY_REFLECTION_TASK_TYPE, memoryReflection);
  workflows.on(MEMORY_CONSOLIDATION_TASK_TYPE, memoryConsolidation);
  workflows.on(MEMORY_IMPORT_TASK_TYPE, memoryImport);

  workflows.every(
    SCHEDULES.MEMORIES_SYNTHESIS,
    defineSchedule({
      name: "memory-synthesis",
      enabledWhen: async (env) =>
        (await d1WritesAllowed(env)) && evaluateServerFlag(env, taskFlags(env).memory_synthesis),
      run: ({ env }) => scheduleDailySynthesis(env),
    }),
  );
}
