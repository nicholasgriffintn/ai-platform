import { RepositoryManager } from "~/repositories";
import type { IEnv } from "~/types";

export const listReplicatePredictions = async (userId: number, env: IEnv) => {
  const repositories = RepositoryManager.getInstance(env);

  const predictions = await repositories.appData.getAppDataByUserAndApp(
    userId,
    "replicate",
  );

  return predictions.map((prediction) => {
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
  });
};
