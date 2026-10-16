import { benchmarkRunTaskDataSchema } from "@ngriffin_uk/polychat-schemas";

import { createRepositories } from "~/infrastructure/database/repositories";
import { executeBenchmarkRun } from "~/modules/benchmarks/application/runner";
import type { IEnv } from "~/types";

import type { TaskHandler, TaskMessage, TaskResult } from "../types";

export class BenchmarkRunHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const parsed = benchmarkRunTaskDataSchema.safeParse(message.task_data);

    if (!parsed.success) {
      return { status: "error", message: "runId and offset are required to run a benchmark" };
    }

    return executeBenchmarkRun(env, createRepositories(env), parsed.data);
  }
}
