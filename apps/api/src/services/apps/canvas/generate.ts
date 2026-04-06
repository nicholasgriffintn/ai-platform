import type { IEnv, IUser } from "~/types";
import { getModelConfigByModel } from "~/lib/providers/models";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType, getErrorMessage } from "~/utils/errors";
import { executeReplicateModel } from "~/services/apps/replicate/execute";
import type { CanvasGenerateParams } from "./types";
import { prepareCanvasInputForModel } from "./prepare-input";
import { validateCanvasModelInputRequirements } from "./input-requirements";

export interface CanvasGenerationResultItem {
	modelId: string;
	modelName: string;
	provider?: string;
	status: "processing" | "completed" | "failed";
	generationId?: string;
	error?: string;
}

export interface GenerateCanvasRequest {
	context?: ServiceContext;
	env?: IEnv;
	user: IUser;
	params: CanvasGenerateParams;
}

export async function generateCanvasBatch(
	req: GenerateCanvasRequest,
): Promise<CanvasGenerationResultItem[]> {
	const { params, context, env, user } = req;

	if (!user?.id) {
		throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
	}

	if (!params.modelIds.length) {
		throw new AssistantError(
			"At least one model must be selected",
			ErrorType.PARAMS_ERROR,
		);
	}

	const uniqueModelIds = Array.from(new Set(params.modelIds));

	const generations = await Promise.all(
		uniqueModelIds.map(async (modelId) => {
			const modelConfig = await getModelConfigByModel(modelId, env);
			if (!modelConfig) {
				return {
					modelId,
					modelName: modelId,
					status: "failed" as const,
					error: `Model ${modelId} is not available for ${params.mode} generation.`,
				};
			}

			try {
				const outputs = modelConfig.modalities?.output ?? [];
				if (!outputs.includes(params.mode)) {
					throw new AssistantError(
						`Model ${modelId} does not support ${params.mode} output.`,
						ErrorType.PARAMS_ERROR,
					);
				}

				const inputValidationError = validateCanvasModelInputRequirements({
					model: modelConfig,
					request: params,
				});
				if (inputValidationError) {
					throw new AssistantError(
						inputValidationError,
						ErrorType.PARAMS_ERROR,
					);
				}

				const input = prepareCanvasInputForModel({
					model: modelConfig,
					request: params,
				});

				const prediction = await executeReplicateModel({
					context,
					env,
					user,
					params: {
						modelId,
						input,
						replicateWaitSeconds: 0,
					},
					storage: {
						appId: "canvas",
						itemType: "generation",
						extraData: {
							mode: params.mode,
						},
					},
				});

				const responseData = prediction?.data;
				const generationId =
					responseData && typeof responseData === "object"
						? (responseData.id as string | undefined)
						: undefined;

				if (typeof generationId !== "string" || !generationId) {
					throw new AssistantError(
						"Queued generation missing id",
						ErrorType.PROVIDER_ERROR,
					);
				}

				const statusCandidate =
					responseData && typeof responseData === "object"
						? (responseData.status as string | undefined)
						: undefined;
				const normalizedStatus: "processing" | "completed" =
					statusCandidate === "completed" ? "completed" : "processing";

				const generationError =
					responseData && typeof responseData === "object"
						? (responseData.error as string | undefined)
						: undefined;
				const status: CanvasGenerationResultItem["status"] = generationError
					? "failed"
					: normalizedStatus;

				return {
					modelId,
					modelName: modelConfig.name ?? modelId,
					provider: modelConfig.provider,
					status,
					generationId,
					error: generationError,
				};
			} catch (error) {
				return {
					modelId,
					modelName: modelConfig.name ?? modelId,
					provider: modelConfig.provider,
					status: "failed" as const,
					error: getErrorMessage(error, "Failed to queue generation"),
				};
			}
		}),
	);

	return generations;
}
