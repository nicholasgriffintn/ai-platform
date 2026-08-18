import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";

import { safeParseJson } from "../../../utils/json";

export const listReplicatePredictions = async ({
  context,
  env,
  userId,
  projectId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  userId: number;
  projectId?: string;
}) => {
  const serviceContext = resolveServiceContext({ context, env });

  const predictions = projectId
    ? await serviceContext.repositories.outputs.listProjectOutputs(projectId, "replicate")
    : await serviceContext.repositories.outputs.listPersonalOutputs(userId, "replicate");

  const results = await Promise.all(
    predictions.map(async (prediction) => {
      const data = safeParseJson<Record<string, unknown>>(prediction.content) ?? {};

      return {
        id: prediction.group_id || prediction.id,
        modelId: data.modelId,
        modelName: data.modelName,
        status: data.status,
        createdAt: data.createdAt,
        input: data.input,
        output: data.output,
        error: data.error,
        predictionData: data.predictionData,
        outputRecord: prediction,
      };
    }),
  );

  return results;
};
