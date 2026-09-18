import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";

export const getReplicatePredictionDetails = async ({
  context,
  env,
  predictionId,
  userId,
  projectId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  predictionId: string;
  userId: number;
  projectId?: string;
}) => {
  const serviceContext = resolveServiceContext({ context, env });

  const prediction = projectId
    ? await serviceContext.repositories.outputs.getProjectOutput(projectId, predictionId)
    : await serviceContext.repositories.outputs.getPersonalOutput(userId, predictionId);

  if (!prediction) {
    throw new AssistantError("Prediction not found", ErrorType.NOT_FOUND);
  }

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
};
