import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { safeParseJson } from "../../../utils/json";

export const getReplicatePredictionDetails = async ({
	context,
	env,
	predictionId,
	userId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	predictionId: string;
	userId: number;
}) => {
	const serviceContext = resolveServiceContext({ context, env });

	const prediction =
		await serviceContext.repositories.appData.getAppDataById(predictionId);

	if (!prediction) {
		throw new AssistantError("Prediction not found", ErrorType.NOT_FOUND);
	}

	if (prediction.user_id !== userId) {
		throw new AssistantError("Unauthorized", ErrorType.UNAUTHORIZED);
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
