import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import { AIProviderFactory } from "~/lib/providers/factory";
import type { AsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import type { IEnv } from "~/types";
import { safeParseJson } from "../../../utils/json";

export const listReplicatePredictions = async ({
	context,
	env,
	userId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	userId: number;
}) => {
	const serviceContext = resolveServiceContext({ context, env });

	const predictions =
		await serviceContext.repositories.appData.getAppDataByUserAndApp(
			userId,
			"replicate",
		);

	const results = await Promise.all(
		predictions.map(async (prediction) => {
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
								completion_id: prediction.item_id || prediction.id,
							},
							userId,
						);

						if (result.status === "completed" && result.result) {
							data.status = "succeeded";
							data.predictionData = result.result;
							data.output = result.result.response;

							await serviceContext.repositories.appData.updateAppData(
								prediction.item_id || prediction.id,
								data,
							);
						} else if (result.status === "failed") {
							data.status = "failed";
							data.error = result.raw?.error || "Generation failed";

							await serviceContext.repositories.appData.updateAppData(
								prediction.item_id || prediction.id,
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
		}),
	);

	return results;
};
