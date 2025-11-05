import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import { AIProviderFactory } from "~/lib/providers/factory";
import type { AsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
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

	const asyncInvocation = data.predictionData?.data?.asyncInvocation as
		| AsyncInvocationMetadata
		| undefined;

	if (asyncInvocation && data.status === "processing") {
		try {
			const provider = AIProviderFactory.getProvider(
				asyncInvocation.provider || "replicate",
			);

			if (provider?.getAsyncInvocationStatus) {
				const result = await provider.getAsyncInvocationStatus(
					asyncInvocation,
					{
						model: asyncInvocation.context?.version || "",
						env: serviceContext.env,
						messages: [],
						completion_id: predictionId,
					},
					userId,
				);

				if (result.status === "completed" && result.result) {
					data.status = "succeeded";
					data.predictionData = result.result;
					data.output = result.result.response;

					await serviceContext.repositories.appData.updateAppData(
						predictionId,
						data,
					);
				} else if (result.status === "failed") {
					data.status = "failed";
					data.error = result.raw?.error || "Generation failed";

					await serviceContext.repositories.appData.updateAppData(
						predictionId,
						data,
					);
				}
			}
		} catch (error) {
			console.error("Failed to poll async invocation:", error);
		}
	}

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
