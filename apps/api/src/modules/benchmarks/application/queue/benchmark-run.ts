import {
  benchmarkRunTaskDataSchema,
  type BenchmarkRunTaskData,
} from "@ngriffin_uk/polychat-schemas";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";

import { createRepositories } from "~/infrastructure/database/repositories";
import { defineTask } from "~/modules/queue/application/workflows";

import { executeBenchmarkRun, failActiveBenchmarkRun } from "../runner";

export const benchmarkRun = defineTask<BenchmarkRunTaskData>({
  payload: benchmarkRunTaskDataSchema,
  durable: true,
  handle: async (data, { env, execution }) =>
    executeBenchmarkRun(env, createRepositories(env), data, execution.steps),
  onFinalFailure: async (data, error, { env }) => {
    await failActiveBenchmarkRun(
      createRepositories(env),
      data.runId,
      getErrorMessage(error, "Unknown error"),
    );
  },
});
