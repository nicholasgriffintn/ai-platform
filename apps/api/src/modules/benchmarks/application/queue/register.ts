import { BENCHMARK_RUN_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import { SCHEDULES } from "~/config/schedules";
import { createRepositories } from "~/infrastructure/database/repositories";
import { refreshBenchmarkRatings } from "~/modules/benchmarks/application/arena";
import { d1WritesAllowed } from "~/modules/infra/application/write-breaker";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";

import { benchmarkRun } from "./benchmark-run";

export function registerBenchmarksQueue(workflows: AppWorkflows): void {
  workflows.on(BENCHMARK_RUN_TASK_TYPE, benchmarkRun);

  workflows.every(
    SCHEDULES.RECIPE_EXECUTION,
    defineSchedule({
      name: "benchmark-ratings",
      enabledWhen: d1WritesAllowed,
      run: async ({ env }) => {
        await refreshBenchmarkRatings(createRepositories(env));
      },
    }),
  );
}
