import { getModelConfigByModel } from "~/lib/providers/models";
import { validateReplicatePayload } from "~/lib/providers/models/replicateValidation";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { generateId } from "~/utils/id";
import { TaskRepository } from "~/repositories/TaskRepository";
import { TaskService } from "~/services/tasks/TaskService";

const logger = getLogger({ prefix: "services/apps/replicate/execute" });

export interface ExecuteReplicateModelParams {
	modelId: string;
	input: Record<string, any>;
}

export interface ExecuteReplicateModelRequest {
	context?: ServiceContext;
	env?: IEnv;
	params: ExecuteReplicateModelParams;
	user: IUser;
	app_url?: string;
}

export const executeReplicateModel = async (
	req: ExecuteReplicateModelRequest,
) => {
	const { params, context, env, user, app_url } = req;

	if (!params.modelId || !params.input) {
		throw new AssistantError(
			"Missing model ID or input parameters",
			ErrorType.PARAMS_ERROR,
		);
	}

	if (!user?.id) {
		throw new AssistantError("User data required", ErrorType.PARAMS_ERROR);
	}

	const serviceContext = resolveServiceContext({ context, env, user });

	try {
		const modelConfig = await getModelConfigByModel(params.modelId);

		if (!modelConfig) {
			throw new AssistantError(
				`Model configuration not found for ${params.modelId}`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		validateReplicatePayload({
			payload: params.input,
			schema: modelConfig.inputSchema,
			modelName: modelConfig.name || params.modelId,
		});

		const provider = getChatProvider(modelConfig.provider || "replicate", {
			env: serviceContext.env,
			user,
		});

		const predictionId = generateId();

		const predictionData = await provider.getResponse({
			completion_id: predictionId,
			app_url,
			model: modelConfig.matchingModel,
			messages: [
				{
					role: "user",
					content: params.input.prompt,
				},
			],
			body: {
				input: params.input,
			},
			env: serviceContext.env,
			user,
			store: false,
		});

		const isAsync = predictionData?.status === "in_progress";

		const appData = {
			modelId: params.modelId,
			modelName: modelConfig.name,
			input: params.input,
			predictionData,
			status: isAsync ? "processing" : "completed",
			createdAt: new Date().toISOString(),
		};

		const stored =
			await serviceContext.repositories.appData.createAppDataWithItem(
				user.id,
				"replicate",
				predictionId,
				"prediction",
				appData,
			);

		if (!stored?.id) {
			throw new AssistantError(
				"Failed to store prediction data",
				ErrorType.STORAGE_ERROR,
			);
		}

		if (isAsync && serviceContext.env.DB) {
			const taskRepository = new TaskRepository(serviceContext.env);
			const taskService = new TaskService(serviceContext.env, taskRepository);

			await taskService.enqueueTask({
				task_type: "replicate_polling",
				user_id: user.id,
				task_data: {
					predictionId: stored.id,
					userId: user.id,
					modelId: params.modelId,
					startedAt: new Date().toISOString(),
				},
				priority: 6,
			});
		}

		return {
			status: "success",
			content: isAsync
				? `Prediction started: ${predictionId}`
				: `Prediction completed: ${predictionId}`,
			data: {
				id: stored.id,
				...stored,
			},
		};
	} catch (error) {
		logger.error("Failed to execute Replicate model:", {
			error_message: error instanceof Error ? error.message : "Unknown error",
			modelId: params.modelId,
		});
		throw error;
	}
};
