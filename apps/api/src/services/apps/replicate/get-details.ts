import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "../../../utils/json";

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
		? await serviceContext.repositories.appData.getAppDataByProjectAndId(projectId, predictionId)
		: await serviceContext.repositories.appData.getAppDataByUserAndId(userId, predictionId);

	if (!prediction) {
		throw new AssistantError("Prediction not found", ErrorType.NOT_FOUND);
	}

	const data = safeParseJson(prediction.data);

	return {
		id: prediction.item_id || prediction.id,
		modelId: data.modelId,
		modelName: data.modelName,
		status: data.status,
		createdAt: data.createdAt,
		input: data.input,
		output: data.output,
		error: data.error,
		predictionData: data.predictionData,
		...prediction,
	};
};
