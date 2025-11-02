import { RepositoryManager } from "~/repositories";
import { AIProviderFactory } from "~/lib/providers/factory";
import type { AsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import type { IEnv } from "~/types";

export const listReplicatePredictions = async (userId: number, env: IEnv) => {
	const repositories = RepositoryManager.getInstance(env);

	const predictions = await repositories.appData.getAppDataByUserAndApp(
		userId,
		"replicate",
	);

	const results = await Promise.all(
		predictions.map(async (prediction) => {
			const data = JSON.parse(prediction.data);

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
								env,
								messages: [],
								completion_id: prediction.item_id || prediction.id,
							},
							userId,
						);

						if (result.status === "completed" && result.result) {
							data.status = "succeeded";
							data.predictionData = result.result;
							data.output = result.result.response;

							await repositories.appData.updateAppData(
								prediction.item_id || prediction.id,
								data,
							);
						} else if (result.status === "failed") {
							data.status = "failed";
							data.error = result.raw?.error || "Generation failed";

							await repositories.appData.updateAppData(
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
