import {
  modelRegistryEvalTaskDataSchema,
  modelRegistryVersionTaskDataSchema,
} from "@ngriffin_uk/polychat-schemas";

import { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { executeEvalRun } from "~/modules/model-registry/application/eval-runner";
import { inspectVersion } from "~/modules/model-registry/application/inspection";
import type { IEnv } from "~/types";

import type { TaskHandler, TaskMessage, TaskResult } from "../types";

export class ModelRegistryInspectHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const parsed = modelRegistryVersionTaskDataSchema.safeParse(message.task_data);

    if (!parsed.success) {
      return { status: "error", message: "versionId is required to inspect a model version" };
    }

    return inspectVersion(env, RepositoryManager.getInstance(env), parsed.data.versionId);
  }
}

export class ModelRegistryEvalHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const parsed = modelRegistryEvalTaskDataSchema.safeParse(message.task_data);

    if (!parsed.success) {
      return { status: "error", message: "runId is required to execute an eval run" };
    }

    return executeEvalRun(env, RepositoryManager.getInstance(env), parsed.data);
  }
}
