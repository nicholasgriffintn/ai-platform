import type { Repositories } from "~/infrastructure/database/repositories";
import { getAuxiliaryModel } from "~/modules/models/application/resolve";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import type { IEnv } from "~/types";

import type {
  ModelEvalRunRecord,
  ModelEvalSuiteRecord,
} from "../infrastructure/ModelEvalRepository";
import type { EvalJudge } from "./run-results";

export async function resolveEvaluationJudge(
  env: IEnv,
  repositories: Repositories,
  suite: Pick<ModelEvalSuiteRecord, "workspace_id" | "created_by">,
  run: Pick<ModelEvalRunRecord, "created_by">,
): Promise<EvalJudge> {
  const userId = run.created_by ?? suite.created_by;
  const user = userId ? await repositories.get(UserRepository).getUserById(userId) : null;
  const model = await getAuxiliaryModel(env, user ?? undefined, {
    workspaceId: suite.workspace_id,
  });

  return { ...model, user: user ?? undefined };
}
