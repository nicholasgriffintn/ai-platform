import type { IEnv, IUser } from "~/types";
import { getModelConfigByModel } from "~/lib/providers/models";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType, getErrorMessage } from "~/utils/errors";
import { executeReplicateModel } from "~/services/apps/replicate/execute";
import { executeModelGeneration } from "~/services/apps/generation/execute";
import { readStringField } from "~/utils/recordFields";
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

function getCanvasResultStatus(data: unknown): "processing" | "completed" | "failed" {
	const error = readStringField(data, "error");
	if (error) {
		return "failed";
	}

	return readStringField(data, "status") === "completed" ? "completed" : "processing";
}

function createFailedCanvasResult({
	error,
	modelId,
	modelName,
	provider,
}: {
	error: string;
	modelId: string;
	modelName: string;
	provider?: string;
}): CanvasGenerationResultItem {
	return {
		modelId,
		modelName,
		provider,
		status: "failed",
		error,
	};
}

async function executeCanvasGeneration({
	context,
	env,
	input,
	mode,
	modelId,
	provider,
	user,
}: {
	context?: ServiceContext;
	env?: IEnv;
	input: Record<string, unknown>;
	mode: CanvasGenerateParams["mode"];
	modelId: string;
	provider?: string;
	user: IUser;
}) {
	if (provider === "replicate") {
		return executeReplicateModel({
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
					mode,
				},
			},
		});
	}

	return executeModelGeneration({
		context,
		env,
		user,
		params: {
			modelId,
			input,
		},
		storage: {
			appId: "canvas",
			itemType: "generation",
			extraData: {
				mode,
			},
		},
	});
}

export async function generateCanvasBatch(
	req: GenerateCanvasRequest,
): Promise<CanvasGenerationResultItem[]> {
	const { params, context, env, user } = req;

	if (!user?.id) {
		throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
	}

	if (!params.modelIds.length) {
		throw new AssistantError("At least one model must be selected", ErrorType.PARAMS_ERROR);
	}

	const uniqueModelIds = Array.from(new Set(params.modelIds));

	const generations = await Promise.all(
		uniqueModelIds.map(async (modelId) => {
			const modelConfig = await getModelConfigByModel(modelId, env);
			if (!modelConfig) {
				return createFailedCanvasResult({
					modelId,
					modelName: modelId,
					error: `Model ${modelId} is not available for ${params.mode} generation.`,
				});
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
					throw new AssistantError(inputValidationError, ErrorType.PARAMS_ERROR);
				}

				const input = prepareCanvasInputForModel({
					model: modelConfig,
					request: params,
				});

				const prediction = await executeCanvasGeneration({
					context,
					env,
					user,
					modelId,
					mode: params.mode,
					provider: modelConfig.provider,
					input,
				});

				const responseData = prediction?.data;
				const generationId = readStringField(responseData, "id");

				if (typeof generationId !== "string" || !generationId) {
					throw new AssistantError("Queued generation missing id", ErrorType.PROVIDER_ERROR);
				}

				const generationError = readStringField(responseData, "error");
				const status = getCanvasResultStatus(responseData);

				return {
					modelId,
					modelName: modelConfig.name ?? modelId,
					provider: modelConfig.provider,
					status,
					generationId,
					error: generationError,
				};
			} catch (error) {
				return createFailedCanvasResult({
					modelId,
					modelName: modelConfig.name ?? modelId,
					provider: modelConfig.provider,
					error: getErrorMessage(error, "Failed to queue generation"),
				});
			}
		}),
	);

	return generations;
}
