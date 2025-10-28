import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export const getReplicatePredictionDetails = async (
  predictionId: string,
  userId: number,
  env: IEnv,
) => {
  const repositories = RepositoryManager.getInstance(env);

  const prediction = await repositories.appData.getAppDataById(predictionId);

  if (!prediction) {
    throw new AssistantError("Prediction not found", ErrorType.NOT_FOUND);
  }

  if (prediction.user_id !== userId) {
    throw new AssistantError("Unauthorized", ErrorType.UNAUTHORIZED);
  }

  const data = JSON.parse(prediction.data);

  return {
    id: prediction.item_id || prediction.id,
    modelId: data.modelId,
    modelName: data.modelName,
    status: data.status,
    createdAt: data.createdAt,
    input: data.input,
    predictionData: data.predictionData,
    ...prediction,
  };
};
